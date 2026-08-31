import asyncio
import importlib

import pytest

from connection_manager import ConnectionManager
from game_logic import RESOURCE_INCOME_PER_NODE
from models import (
    DefenceLevel,
    GameState,
    GameStatus,
    Node,
    Player,
    Task,
)
from task_manager import TaskManager


class FakeGameRepository:
    def __init__(self, game):
        self.game = game.model_copy(deep=True) if game else None
        self.events = []
        self.save_count = 0

    async def get_game(self, game_id):
        if self.game is None:
            return None

        return self.game.model_copy(deep=True)

    async def save_game(self, game_id, game):
        self.events.append("save")
        self.save_count += 1
        self.game = game.model_copy(deep=True)


class FakeRoomRepository:
    def __init__(self, room=object()):
        self.room = room

    async def get_room(self, room_id):
        return self.room


class FailOnceGameRepository(FakeGameRepository):
    def __init__(self, game):
        super().__init__(game)
        self.get_attempts = 0

    async def get_game(self, game_id):
        self.get_attempts += 1

        if self.get_attempts == 1:
            raise RuntimeError("transient repository failure")

        return await super().get_game(game_id)


class FailFirstSaveGameRepository(FakeGameRepository):
    def __init__(self, game):
        super().__init__(game)
        self.save_attempts = 0

    async def save_game(self, game_id, game):
        self.events.append("save")
        self.save_attempts += 1

        if self.save_attempts == 1:
            raise RuntimeError("transient final save failure")

        self.save_count += 1
        self.game = game.model_copy(deep=True)


class RecordingTaskManager(TaskManager):
    def __init__(self, events):
        super().__init__([])
        self.events = events

    def remove_task(self, task_id):
        self.events.append("task_cleanup")
        super().remove_task(task_id)


class FakeWebSocket:
    def __init__(self):
        self.messages = []

    async def send_json(self, message):
        self.messages.append(message)


class RecordingConnectionManager(ConnectionManager):
    def __init__(self, events):
        super().__init__()
        self.events = events

    async def broadcast_to_room(self, room_id, message):
        self.events.append("broadcast")
        await super().broadcast_to_room(room_id, message)


class FinishRecordingConnectionManager(ConnectionManager):
    def __init__(self, events):
        super().__init__()
        self.events = events

    async def broadcast_to_room(self, room_id, message):
        self.events.append(f"broadcast:{message['type']}")
        await super().broadcast_to_room(room_id, message)


class ControlledSleep:
    def __init__(self):
        self.waiters = []
        self.intervals = []

    async def __call__(self, interval):
        self.intervals.append(interval)
        waiter = asyncio.Event()
        self.waiters.append(waiter)
        await waiter.wait()

    async def wait_for_call(self, count):
        for _ in range(20):
            if len(self.waiters) >= count:
                return
            await asyncio.sleep(0)

        raise AssertionError("runtime did not reach sleep")

    def release(self, index):
        self.waiters[index].set()


def create_running_game(remaining_time=900):
    return GameState(
        status=GameStatus.RUNNING,
        remaining_time_seconds=remaining_time,
        players={
            "alice": Player(
                id="alice",
                nickname="Alice",
                owned_node_ids=["node_alice"],
            ),
            "bob": Player(
                id="bob",
                nickname="Bob",
                owned_node_ids=["node_bob"],
            ),
            "observer": Player(
                id="observer",
                nickname="Observer",
            ),
        },
        nodes={
            "node_alice": Node(
                id="node_alice",
                owner_id="alice",
            ),
            "node_bob": Node(
                id="node_bob",
                owner_id="bob",
            ),
            "free_node": Node(id="free_node"),
        },
    )


def create_manager(
    repository,
    connections,
    sleep=None,
    room_repository=None,
    task_manager=None,
):
    module = importlib.import_module("game_loop")

    kwargs = {}
    if sleep is not None:
        kwargs["sleep"] = sleep
    if room_repository is not None:
        kwargs["room_repository"] = room_repository
    if task_manager is not None:
        kwargs["task_manager"] = task_manager

    return module.GameLoopManager(
        repository,
        connections,
        **kwargs,
    )


@pytest.mark.anyio
async def test_one_runtime_tick_advances_timer_and_saves_state():
    repository = FakeGameRepository(create_running_game())
    connections = RecordingConnectionManager(repository.events)
    manager = create_manager(repository, connections)

    should_continue = await manager._tick_once(
        "room_1",
        "game_1",
    )

    assert should_continue is True
    assert repository.game.remaining_time_seconds == 899
    assert repository.save_count == 1


@pytest.mark.anyio
async def test_one_runtime_tick_applies_resource_income_once():
    game = create_running_game()
    starting_resources = {
        player_id: player.resources
        for player_id, player in game.players.items()
    }
    repository = FakeGameRepository(game)
    connections = RecordingConnectionManager(repository.events)
    manager = create_manager(repository, connections)

    await manager._tick_once("room_1", "game_1")

    assert repository.game.players["alice"].resources == (
        starting_resources["alice"]
        + RESOURCE_INCOME_PER_NODE
    )
    assert repository.game.players["bob"].resources == (
        starting_resources["bob"]
        + RESOURCE_INCOME_PER_NODE
    )
    assert repository.game.players["observer"].resources == (
        starting_resources["observer"]
    )
    assert repository.save_count == 1


@pytest.mark.anyio
async def test_start_is_exactly_once_for_the_same_game():
    repository = FakeGameRepository(create_running_game())
    connections = RecordingConnectionManager(repository.events)
    sleep = ControlledSleep()
    manager = create_manager(
        repository,
        connections,
        sleep=sleep,
    )

    first_task = manager.start("room_1", "game_1")
    second_task = manager.start("room_1", "game_1")

    assert first_task is second_task
    assert manager.tasks == {
        "game_1": first_task,
    }

    await sleep.wait_for_call(1)
    sleep.release(0)

    for _ in range(20):
        if repository.save_count == 1:
            break
        await asyncio.sleep(0)

    assert repository.game.remaining_time_seconds == 899
    assert repository.game.players["alice"].resources == (
        20.0 + RESOURCE_INCOME_PER_NODE
    )
    assert repository.save_count == 1

    await manager.stop_all()


@pytest.mark.anyio
async def test_runtime_saves_before_broadcasting_same_state_to_room():
    repository = FakeGameRepository(create_running_game())
    connections = RecordingConnectionManager(repository.events)
    alice_socket = FakeWebSocket()
    bob_socket = FakeWebSocket()

    connections.connections = {
        "alice": alice_socket,
        "bob": bob_socket,
    }
    connections.player_rooms = {
        "alice": "room_1",
        "bob": "room_1",
    }
    manager = create_manager(repository, connections)

    await manager._tick_once("room_1", "game_1")

    assert repository.events == ["save", "broadcast"]
    assert alice_socket.messages == bob_socket.messages
    assert alice_socket.messages == [
        {
            "type": "GAME_STATE",
            "game_id": "game_1",
            "game": repository.game.model_dump(mode="json"),
        }
    ]
    assert alice_socket.messages[0]["game"][
        "remaining_time_seconds"
    ] == 899
    assert alice_socket.messages[0]["game"]["players"][
        "alice"
    ]["resources"] == 20.0 + RESOURCE_INCOME_PER_NODE


@pytest.mark.anyio
async def test_finished_game_stops_and_cleans_registry():
    repository = FakeGameRepository(
        create_running_game(remaining_time=1)
    )
    connections = RecordingConnectionManager(repository.events)
    sleep = ControlledSleep()
    manager = create_manager(
        repository,
        connections,
        sleep=sleep,
    )

    task = manager.start("room_1", "game_1")

    await sleep.wait_for_call(1)
    sleep.release(0)
    await task

    assert repository.game.status == GameStatus.FINISHED
    assert repository.game.remaining_time_seconds == 0
    assert repository.save_count == 1
    assert len(sleep.waiters) == 1
    assert manager.tasks == {}


@pytest.mark.anyio
async def test_final_tick_saves_then_broadcasts_state_and_finish_once():
    game = create_running_game(remaining_time=1)
    game.players["alice"].score = 12
    game.players["bob"].score = 7
    repository = FakeGameRepository(game)
    connections = FinishRecordingConnectionManager(repository.events)
    alice_socket = FakeWebSocket()
    bob_socket = FakeWebSocket()
    connections.connections = {
        "alice": alice_socket,
        "bob": bob_socket,
    }
    connections.player_rooms = {
        "alice": "room_1",
        "bob": "room_1",
    }
    sleep = ControlledSleep()
    manager = create_manager(
        repository,
        connections,
        sleep=sleep,
    )

    task = manager.start("room_1", "game_1")
    await sleep.wait_for_call(1)
    sleep.release(0)
    await task

    assert repository.events == [
        "save",
        "broadcast:GAME_STATE",
        "broadcast:GAME_FINISHED",
    ]
    assert alice_socket.messages == bob_socket.messages
    assert [
        message["type"]
        for message in alice_socket.messages
    ] == ["GAME_STATE", "GAME_FINISHED"]
    assert alice_socket.messages[0]["game"] == (
        repository.game.model_dump(mode="json")
    )
    assert alice_socket.messages[1] == {
        "type": "GAME_FINISHED",
        "game_id": "game_1",
        "winner_id": "alice",
        "scores": {
            "alice": 12,
            "bob": 7,
            "observer": 0,
        },
    }
    assert repository.game.status == GameStatus.FINISHED
    assert repository.game.remaining_time_seconds == 0
    assert manager.tasks == {}
    assert len(sleep.waiters) == 1


@pytest.mark.anyio
async def test_failed_final_save_keeps_runtime_task_until_successful_retry():
    game = create_running_game(remaining_time=1)
    active_task = Task(
        id="task_1",
        node_id="node_bob",
        player_id="alice",
        defence_level=DefenceLevel.K1,
        question="Question",
    )
    game.tasks[active_task.id] = active_task
    game.nodes[active_task.node_id].active_attack_player_id = (
        active_task.player_id
    )
    repository = FailFirstSaveGameRepository(game)
    connections = FinishRecordingConnectionManager(repository.events)
    task_manager = RecordingTaskManager(repository.events)
    task_manager.tasks[active_task.id] = active_task
    sleep = ControlledSleep()
    manager = create_manager(
        repository,
        connections,
        sleep=sleep,
        task_manager=task_manager,
    )
    runtime_task = manager.start("room_1", "game_1")

    try:
        await sleep.wait_for_call(1)
        sleep.release(0)
        await sleep.wait_for_call(2)

        assert runtime_task.done() is False
        assert manager.tasks["game_1"] is runtime_task
        assert repository.game.status == GameStatus.RUNNING
        assert repository.game.remaining_time_seconds == 1
        assert active_task.id in repository.game.tasks
        assert active_task.id in task_manager.tasks
        assert not any(
            event == "broadcast:GAME_FINISHED"
            for event in repository.events
        )

        sleep.release(1)
        await runtime_task

        assert repository.game.status == GameStatus.FINISHED
        assert repository.game.tasks == {}
        assert repository.game.nodes[
            active_task.node_id
        ].active_attack_player_id is None
        assert active_task.id not in task_manager.tasks
        assert repository.events == [
            "save",
            "save",
            "task_cleanup",
            "broadcast:GAME_STATE",
            "broadcast:GAME_FINISHED",
        ]
        assert repository.events.count(
            "broadcast:GAME_FINISHED"
        ) == 1
        assert manager.tasks == {}
    finally:
        await manager.stop_all()


@pytest.mark.anyio
async def test_shutdown_cancels_tasks_and_cleans_registry():
    repository = FakeGameRepository(create_running_game())
    connections = RecordingConnectionManager(repository.events)
    sleep = ControlledSleep()
    manager = create_manager(
        repository,
        connections,
        sleep=sleep,
    )

    task = manager.start("room_1", "game_1")
    await sleep.wait_for_call(1)

    await manager.stop_all()

    assert task.cancelled()
    assert manager.tasks == {}
    assert repository.save_count == 0


@pytest.mark.anyio
@pytest.mark.parametrize("missing_state", ["game", "room"])
async def test_missing_authoritative_state_stops_and_cleans_registry(
    missing_state,
):
    game = None if missing_state == "game" else create_running_game()
    room = None if missing_state == "room" else object()
    repository = FakeGameRepository(game)
    room_repository = FakeRoomRepository(room)
    connections = RecordingConnectionManager(repository.events)
    sleep = ControlledSleep()
    manager = create_manager(
        repository,
        connections,
        sleep=sleep,
        room_repository=room_repository,
    )

    task = manager.start("room_1", "game_1")
    await sleep.wait_for_call(1)
    sleep.release(0)
    await task

    assert manager.tasks == {}
    assert repository.save_count == 0


@pytest.mark.anyio
async def test_transient_tick_failure_keeps_runtime_alive_for_next_tick(
    caplog,
):
    repository = FailOnceGameRepository(create_running_game())
    connections = RecordingConnectionManager(repository.events)
    sleep = ControlledSleep()
    manager = create_manager(
        repository,
        connections,
        sleep=sleep,
    )
    task = manager.start("room_1", "game_1")

    try:
        await sleep.wait_for_call(1)
        sleep.release(0)
        await sleep.wait_for_call(2)

        assert task.done() is False
        assert manager.tasks["game_1"] is task
        assert repository.game.remaining_time_seconds == 900
        assert repository.save_count == 0

        sleep.release(1)
        await sleep.wait_for_call(3)

        assert repository.game.remaining_time_seconds == 899
        assert repository.save_count == 1
        assert task.done() is False
        assert manager.tasks["game_1"] is task

        error_record = next(
            record
            for record in caplog.records
            if record.levelname == "ERROR"
        )
        assert "game_1" in error_record.getMessage()
        assert "room_1" in error_record.getMessage()
        assert isinstance(
            error_record.exc_info[1],
            RuntimeError,
        )
    finally:
        await manager.stop_all()

        if task.done() and not task.cancelled():
            task.exception()
