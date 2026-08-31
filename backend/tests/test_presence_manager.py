import asyncio

import pytest

from connection_manager import ConnectionManager
from game_logic import can_attack
from map_preview import build_room_map_preview
from models import (
    DefenceLevel,
    GameState,
    GameStatus,
    Node,
    Player,
    Room,
    RoomStatus,
    Task,
)
from presence_manager import (
    DISCONNECT_GRACE_SECONDS,
    PresenceManager,
)
from session_registry import SessionRegistry


class ControlledSleep:
    def __init__(self):
        self.calls = []
        self.waiters = []

    async def __call__(self, delay):
        self.calls.append(delay)
        waiter = asyncio.get_running_loop().create_future()
        self.waiters.append(waiter)
        await waiter

    def release_all(self):
        for waiter in self.waiters:
            if not waiter.done():
                waiter.set_result(None)


class FakeWebSocket:
    def __init__(self, *, broken=False):
        self.messages = []
        self.closed = False
        self.broken = broken

    async def send_json(self, message):
        if self.broken:
            raise RuntimeError("socket send failed")
        self.messages.append(message)

    async def close(self):
        self.closed = True


class MemoryRoomRepository:
    def __init__(self, rooms):
        self.rooms = {
            room.id: room.model_copy(deep=True)
            for room in rooms
        }
        self.deleted = []
        self.removed_active = []

    async def get_room(self, room_id):
        room = self.rooms.get(room_id)
        return room.model_copy(deep=True) if room else None

    async def save_room(self, room):
        self.rooms[room.id] = room.model_copy(deep=True)

    async def delete_room(self, room_id):
        self.deleted.append(room_id)
        self.rooms.pop(room_id, None)

    async def remove_active_room(self, room_id):
        self.removed_active.append(room_id)


class MemoryGameRepository:
    def __init__(self, games=None):
        self.games = {
            game_id: game.model_copy(deep=True)
            for game_id, game in (games or {}).items()
        }
        self.saved = []

    async def get_game(self, game_id):
        game = self.games.get(game_id)
        return game.model_copy(deep=True) if game else None

    async def save_game(self, game_id, game):
        self.saved.append(game_id)
        self.games[game_id] = game.model_copy(deep=True)


class PausedGameRepository(MemoryGameRepository):
    def __init__(self, games):
        super().__init__(games)
        self.get_started = asyncio.Event()
        self.allow_get = asyncio.Event()

    async def get_game(self, game_id):
        self.get_started.set()
        await self.allow_get.wait()
        return await super().get_game(game_id)


class FailingGameRepository(MemoryGameRepository):
    async def save_game(self, game_id, game):
        raise RuntimeError("save game failed")


class FailingRoomRepository(MemoryRoomRepository):
    async def save_room(self, room):
        raise RuntimeError("save room failed")


class FakeGameLoopManager:
    def __init__(self):
        self.locks = {}

    def lock(self, game_id):
        return self.locks.setdefault(game_id, asyncio.Lock())


class FakeTaskManager:
    def __init__(self, tasks=None):
        self.tasks = dict(tasks or {})

    def get_task(self, task_id):
        if task_id not in self.tasks:
            raise ValueError("TASK_NOT_FOUND")
        return self.tasks[task_id]

    def remove_task(self, task_id):
        if task_id not in self.tasks:
            raise ValueError("TASK_NOT_FOUND")
        del self.tasks[task_id]


def make_room(*, game_id=None, status=RoomStatus.LOBBY):
    return Room(
        id="ABC234",
        host_id="alice",
        status=status,
        player_ids=["alice", "bob"],
        player_nicknames={
            "alice": "Alice",
            "bob": "Bob",
        },
        map_preview_seed=12345,
        game_id=game_id,
    )


def make_running_attack():
    task = Task(
        id="task_1",
        node_id="target",
        player_id="alice",
        defence_level=DefenceLevel.K1,
        template_id="template_1",
        question="Question",
    )
    game = GameState(
        status=GameStatus.RUNNING,
        remaining_time_seconds=100,
        players={
            "alice": Player(
                id="alice",
                nickname="Alice",
                owned_node_ids=["spawn_a"],
                spawn_node_id="spawn_a",
            ),
            "bob": Player(
                id="bob",
                nickname="Bob",
                owned_node_ids=["spawn_b"],
                spawn_node_id="spawn_b",
            ),
        },
        nodes={
            "spawn_a": Node(id="spawn_a", owner_id="alice"),
            "spawn_b": Node(id="spawn_b", owner_id="bob"),
            "target": Node(
                id="target",
                owner_id="bob",
                active_attack_player_id="alice",
                neighbor_ids=["spawn_a"],
            ),
        },
        tasks={task.id: task},
    )
    return game, task


def make_presence_manager(room, *, game=None, task_manager=None):
    room_repository = MemoryRoomRepository([room])
    game_repository = MemoryGameRepository(
        {room.game_id: game} if room.game_id and game else {}
    )
    connection_manager = ConnectionManager()
    session_registry = SessionRegistry()
    game_loop_manager = FakeGameLoopManager()
    sleep = ControlledSleep()
    manager = PresenceManager(
        room_repository=room_repository,
        game_repository=game_repository,
        connection_manager=connection_manager,
        session_registry=session_registry,
        game_loop_manager=game_loop_manager,
        task_manager=task_manager or FakeTaskManager(),
        sleep=sleep,
    )
    connection_manager.set_disconnect_handler(
        manager.handle_disconnect
    )
    return {
        "manager": manager,
        "rooms": room_repository,
        "games": game_repository,
        "connections": connection_manager,
        "sessions": session_registry,
        "sleep": sleep,
    }


@pytest.mark.anyio
async def test_current_disconnect_marks_offline_and_schedules_one_grace():
    context = make_presence_manager(make_room())
    manager = context["manager"]
    connections = context["connections"]
    alice_socket = FakeWebSocket()
    bob_socket = FakeWebSocket()
    await connections.connect("alice", "ABC234", alice_socket)
    await connections.connect("bob", "ABC234", bob_socket)
    await manager.mark_online("alice", "ABC234", broadcast=False)
    await manager.mark_online("bob", "ABC234", broadcast=False)

    removed = await connections.disconnect("alice", alice_socket)
    await asyncio.sleep(0)

    assert removed is True
    assert manager.status("alice") == "offline"
    assert len(manager.grace_tasks) == 1
    assert context["sleep"].calls == [DISCONNECT_GRACE_SECONDS]
    assert bob_socket.messages[-1]["players"][0]["status"] == "offline"

    removed_again = await connections.disconnect("alice", alice_socket)
    assert removed_again is False
    assert len(manager.grace_tasks) == 1

    await manager.stop_all()


@pytest.mark.anyio
async def test_stale_socket_close_does_not_mark_offline_or_schedule_grace():
    context = make_presence_manager(make_room())
    manager = context["manager"]
    connections = context["connections"]
    old_socket = FakeWebSocket()
    new_socket = FakeWebSocket()
    await connections.connect("alice", "ABC234", old_socket)
    await manager.mark_online("alice", "ABC234", broadcast=False)
    await connections.connect("alice", "ABC234", new_socket)

    removed = await connections.disconnect("alice", old_socket)

    assert removed is False
    assert manager.status("alice") == "online"
    assert manager.grace_tasks == {}
    assert connections.connections["alice"] is new_socket


@pytest.mark.anyio
async def test_resume_during_grace_cancels_cleanup_and_restores_online():
    context = make_presence_manager(make_room())
    manager = context["manager"]
    connections = context["connections"]
    old_socket = FakeWebSocket()
    new_socket = FakeWebSocket()
    bob_socket = FakeWebSocket()
    await connections.connect("alice", "ABC234", old_socket)
    await connections.connect("bob", "ABC234", bob_socket)
    await manager.mark_online("alice", "ABC234", broadcast=False)
    await manager.mark_online("bob", "ABC234", broadcast=False)
    await connections.disconnect("alice", old_socket)
    await asyncio.sleep(0)

    assert next(
        player
        for player in bob_socket.messages[-1]["players"]
        if player["id"] == "alice"
    )["status"] == "offline"

    await connections.connect("alice", "ABC234", new_socket)
    await manager.mark_online("alice", "ABC234", broadcast=True)
    context["sleep"].release_all()
    await asyncio.sleep(0)

    room = await context["rooms"].get_room("ABC234")
    assert manager.status("alice") == "online"
    assert manager.grace_tasks == {}
    assert room.player_ids == ["alice", "bob"]
    assert next(
        player
        for player in bob_socket.messages[-1]["players"]
        if player["id"] == "alice"
    )["status"] == "online"


@pytest.mark.anyio
async def test_send_failure_uses_same_offline_grace_lifecycle():
    context = make_presence_manager(make_room())
    manager = context["manager"]
    connections = context["connections"]
    broken_socket = FakeWebSocket(broken=True)
    await connections.connect("alice", "ABC234", broken_socket)
    await manager.mark_online("alice", "ABC234", broadcast=False)

    await connections.send_to_player("alice", {"type": "TEST"})
    await asyncio.sleep(0)

    assert "alice" not in connections.connections
    assert manager.status("alice") == "offline"
    assert len(manager.grace_tasks) == 1
    assert context["sleep"].calls == [DISCONNECT_GRACE_SECONDS]

    await manager.stop_all()


@pytest.mark.anyio
async def test_lobby_grace_expiry_removes_ghost_session_and_updates_preview():
    room = make_room()
    context = make_presence_manager(room)
    manager = context["manager"]
    connections = context["connections"]
    alice_socket = FakeWebSocket()
    bob_socket = FakeWebSocket()
    await connections.connect("alice", room.id, alice_socket)
    await connections.connect("bob", room.id, bob_socket)
    await manager.mark_online("alice", room.id, broadcast=False)
    await manager.mark_online("bob", room.id, broadcast=False)
    bob_session = context["sessions"].create("bob", room.id)

    await connections.disconnect("bob", bob_socket)
    await asyncio.sleep(0)
    grace_task = manager.grace_tasks["bob"]
    context["sleep"].release_all()
    await grace_task

    updated_room = await context["rooms"].get_room(room.id)
    assert updated_room.player_ids == ["alice"]
    assert "bob" not in updated_room.player_nicknames
    assert context["sessions"].get(bob_session.token) is None
    assert manager.status("bob") is None
    assert alice_socket.messages[-1]["players"] == [
        {
            "id": "alice",
            "name": "Alice",
            "isHost": True,
            "status": "online",
        }
    ]
    assert alice_socket.messages[-1]["mapPreview"] == (
        build_room_map_preview(updated_room).model_dump(
            mode="json",
            by_alias=True,
        )
    )


@pytest.mark.anyio
async def test_lobby_host_expiry_transfers_host_and_last_player_deletes_room():
    room = make_room()
    context = make_presence_manager(room)
    manager = context["manager"]
    connections = context["connections"]
    alice_socket = FakeWebSocket()
    bob_socket = FakeWebSocket()
    await connections.connect("alice", room.id, alice_socket)
    await connections.connect("bob", room.id, bob_socket)
    await manager.mark_online("alice", room.id, broadcast=False)
    await manager.mark_online("bob", room.id, broadcast=False)

    await connections.disconnect("alice", alice_socket)
    await asyncio.sleep(0)
    first_grace = manager.grace_tasks["alice"]
    context["sleep"].release_all()
    await first_grace

    updated_room = await context["rooms"].get_room(room.id)
    assert updated_room.host_id == "bob"

    await connections.disconnect("bob", bob_socket)
    await asyncio.sleep(0)
    second_grace = manager.grace_tasks["bob"]
    context["sleep"].release_all()
    await second_grace

    assert await context["rooms"].get_room(room.id) is None
    assert context["rooms"].deleted == [room.id]
    assert context["rooms"].removed_active == [room.id]


@pytest.mark.anyio
async def test_running_grace_expiry_cancels_only_abandoned_attack():
    task = Task(
        id="task_1",
        node_id="target",
        player_id="alice",
        defence_level=DefenceLevel.K1,
        template_id="template_1",
        question="Question",
    )
    game = GameState(
        status=GameStatus.RUNNING,
        remaining_time_seconds=100,
        players={
            "alice": Player(
                id="alice",
                nickname="Alice",
                score=7,
                resources=33,
                owned_node_ids=["spawn_a"],
                spawn_node_id="spawn_a",
            ),
            "bob": Player(
                id="bob",
                nickname="Bob",
                owned_node_ids=["spawn_b"],
                spawn_node_id="spawn_b",
            ),
        },
        nodes={
            "spawn_a": Node(id="spawn_a", owner_id="alice"),
            "spawn_b": Node(id="spawn_b", owner_id="bob"),
            "target": Node(
                id="target",
                owner_id="bob",
                active_attack_player_id="alice",
                neighbor_ids=["spawn_a"],
            ),
        },
        tasks={task.id: task},
    )
    room = make_room(game_id="game_1", status=RoomStatus.RUNNING)
    task_manager = FakeTaskManager({task.id: task})
    context = make_presence_manager(
        room,
        game=game,
        task_manager=task_manager,
    )
    manager = context["manager"]
    connections = context["connections"]
    alice_socket = FakeWebSocket()
    bob_socket = FakeWebSocket()
    await connections.connect("alice", room.id, alice_socket)
    await connections.connect("bob", room.id, bob_socket)
    await manager.mark_online("alice", room.id, broadcast=False)
    await manager.mark_online("bob", room.id, broadcast=False)
    alice_session = context["sessions"].create("alice", room.id)

    await connections.disconnect("alice", alice_socket)
    await asyncio.sleep(0)
    grace_task = manager.grace_tasks["alice"]
    context["sleep"].release_all()
    await grace_task

    saved_game = await context["games"].get_game("game_1")
    alice = saved_game.players["alice"]
    assert "alice" in (await context["rooms"].get_room(room.id)).player_ids
    assert alice.spawn_node_id == "spawn_a"
    assert alice.owned_node_ids == ["spawn_a"]
    assert alice.score == 7
    assert alice.resources == 33
    assert saved_game.tasks == {}
    assert task_manager.tasks == {}
    assert saved_game.nodes["target"].active_attack_player_id is None
    assert saved_game.nodes["target"].owner_id == "bob"
    assert context["sessions"].get(alice_session.token) is not None
    assert context["games"].saved == ["game_1"]
    assert bob_socket.messages[-1]["type"] == "GAME_STATE"
    assert can_attack(saved_game, "alice", "target") == (True, None)


@pytest.mark.anyio
async def test_finished_grace_expiry_keeps_player_and_session():
    game = GameState(
        status=GameStatus.FINISHED,
        players={
            "alice": Player(id="alice", nickname="Alice"),
            "bob": Player(id="bob", nickname="Bob"),
        },
    )
    room = make_room(game_id="game_1", status=RoomStatus.FINISHED)
    context = make_presence_manager(room, game=game)
    manager = context["manager"]
    connections = context["connections"]
    socket = FakeWebSocket()
    await connections.connect("alice", room.id, socket)
    await manager.mark_online("alice", room.id, broadcast=False)
    session = context["sessions"].create("alice", room.id)

    await connections.disconnect("alice", socket)
    await asyncio.sleep(0)
    grace_task = manager.grace_tasks["alice"]
    context["sleep"].release_all()
    await grace_task

    assert "alice" in (await context["rooms"].get_room(room.id)).player_ids
    assert "alice" in (await context["games"].get_game("game_1")).players
    assert context["sessions"].get(session.token) is not None
    assert manager.status("alice") == "offline"


@pytest.mark.anyio
async def test_running_cleanup_rechecks_presence_after_paused_game_load():
    game, task = make_running_attack()
    room = make_room(game_id="game_1", status=RoomStatus.RUNNING)
    task_manager = FakeTaskManager({task.id: task})
    context = make_presence_manager(
        room,
        game=game,
        task_manager=task_manager,
    )
    repository = PausedGameRepository({"game_1": game})
    context["manager"].game_repository = repository
    context["games"] = repository
    manager = context["manager"]
    manager.presence["alice"] = "offline"
    manager.generations["alice"] = 1

    cleanup = asyncio.create_task(
        manager._expire("alice", room.id, 1)
    )
    await repository.get_started.wait()

    socket = FakeWebSocket()
    await context["connections"].connect("alice", room.id, socket)
    await manager.mark_online("alice", room.id, broadcast=False)
    repository.allow_get.set()
    await cleanup

    persisted = await MemoryGameRepository.get_game(
        repository,
        "game_1",
    )
    assert task.id in persisted.tasks
    assert task.id in task_manager.tasks
    assert persisted.nodes["target"].active_attack_player_id == "alice"
    assert repository.saved == []


@pytest.mark.anyio
async def test_running_failed_save_keeps_task_manager_and_persisted_task():
    game, task = make_running_attack()
    room = make_room(game_id="game_1", status=RoomStatus.RUNNING)
    task_manager = FakeTaskManager({task.id: task})
    context = make_presence_manager(
        room,
        game=game,
        task_manager=task_manager,
    )
    repository = FailingGameRepository({"game_1": game})
    context["manager"].game_repository = repository
    context["games"] = repository
    manager = context["manager"]
    manager.presence["alice"] = "offline"
    manager.generations["alice"] = 1

    with pytest.raises(RuntimeError, match="save game failed"):
        await manager._expire("alice", room.id, 1)

    persisted = await repository.get_game("game_1")
    assert task.id in persisted.tasks
    assert task.id in task_manager.tasks
    assert persisted.nodes["target"].active_attack_player_id == "alice"
    assert context["connections"].connections == {}


@pytest.mark.anyio
async def test_lobby_failed_save_keeps_membership_session_and_offline_presence():
    room = make_room()
    context = make_presence_manager(room)
    repository = FailingRoomRepository([room])
    context["manager"].room_repository = repository
    context["rooms"] = repository
    manager = context["manager"]
    manager.presence["bob"] = "offline"
    manager.generations["bob"] = 1
    session = context["sessions"].create("bob", room.id)

    with pytest.raises(RuntimeError, match="save room failed"):
        await manager._expire("bob", room.id, 1)

    persisted = await repository.get_room(room.id)
    assert "bob" in persisted.player_ids
    assert "bob" in persisted.player_nicknames
    assert context["sessions"].get(session.token) is not None
    assert manager.status("bob") == "offline"
