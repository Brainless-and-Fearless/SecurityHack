import asyncio

import pytest
import redis.asyncio as redis

from models import GameState, GameStatus, Room, RoomStatus
from redis_repository import GameStateRepository, RoomRepository


@pytest.fixture
async def redis_client():
    client = redis.Redis(
        host="localhost",
        port=6379,
        decode_responses=True,
    )

    yield client

    await client.flushdb()
    await client.aclose()


@pytest.fixture
async def repository(redis_client):
    return RoomRepository(redis_client)

@pytest.fixture
async def game_repository(redis_client):
    return GameStateRepository(redis_client)

@pytest.fixture
def sample_room():
    return Room(
        id="room_1",
        host_id="player_1",
        status=RoomStatus.LOBBY,
        player_ids=["player_1", "player_2"],
        max_players=8,
        game_id=None,
    )


@pytest.mark.anyio
async def test_save_and_get_room(repository, sample_room):
    await repository.save_room(sample_room)

    loaded_room = await repository.get_room("room_1")

    assert loaded_room == sample_room


@pytest.mark.anyio
async def test_get_missing_room_returns_none(repository):
    room = await repository.get_room("missing_room")

    assert room is None


@pytest.mark.anyio
async def test_delete_room(repository, sample_room):
    await repository.save_room(sample_room)

    await repository.delete_room("room_1")

    assert await repository.get_room("room_1") is None


@pytest.mark.anyio
async def test_add_active_room(repository):
    await repository.add_active_room("room_1")

    members = await repository.client.smembers("rooms:active")

    assert "room_1" in members


@pytest.mark.anyio
async def test_remove_active_room(repository):
    await repository.add_active_room("room_1")

    await repository.remove_active_room("room_1")

    members = await repository.client.smembers("rooms:active")

    assert "room_1" not in members


@pytest.mark.anyio
async def test_room_data_survives_redis_round_trip(repository):
    room = Room(
        id="room_2",
        host_id="player_5",
        status=RoomStatus.RUNNING,
        player_ids=[
            "player_5",
            "player_7",
            "player_9",
        ],
        max_players=8,
        game_id="game_2",
    )

    await repository.save_room(room)

    loaded_room = await repository.get_room("room_2")

    assert loaded_room is not None
    assert loaded_room.id == "room_2"
    assert loaded_room.host_id == "player_5"
    assert loaded_room.status == RoomStatus.RUNNING
    assert loaded_room.player_ids == [
        "player_5",
        "player_7",
        "player_9",
    ]
    assert loaded_room.max_players == 8
    assert loaded_room.game_id == "game_2"
    assert loaded_room.created_at == room.created_at


@pytest.mark.anyio
async def test_save_and_get_game(game_repository):
    game = GameState(
        status=GameStatus.RUNNING,
        players={},
        nodes={},
        tasks={},
        remaining_time_seconds=900,
    )

    await game_repository.save_game(
        "game_1",
        game,
    )

    loaded_game = await game_repository.get_game(
        "game_1"
    )

    assert loaded_game == game


@pytest.mark.anyio
async def test_get_missing_game_returns_none(game_repository):
    game = await game_repository.get_game("missing_game")

    assert game is None        


@pytest.mark.anyio
async def test_delete_game(game_repository):
    game = GameState(
        status=GameStatus.RUNNING,
        players={},
        nodes={},
        tasks={},
        remaining_time_seconds=900,
    )

    await game_repository.save_game(
        "game_1",
        game,
    )

    await game_repository.delete_game(
        "game_1"
    )

    assert await game_repository.get_game(
        "game_1"
    ) is None    


@pytest.mark.anyio
async def test_game_state_survives_redis_round_trip(
    game_repository,
):
    game = GameState(
        status=GameStatus.RUNNING,
        players={},
        nodes={},
        tasks={},
        remaining_time_seconds=742,
    )

    await game_repository.save_game(
        "game_42",
        game,
    )

    loaded_game = await game_repository.get_game(
        "game_42"
    )

    assert loaded_game is not None
    assert loaded_game.status == GameStatus.RUNNING
    assert loaded_game.remaining_time_seconds == 742    


@pytest.mark.anyio
async def test_concurrent_game_updates_are_not_lost(
    redis_client,
):
    repository = GameStateRepository(redis_client)

    game = GameState(
        status=GameStatus.RUNNING,
        players={},
        nodes={},
        tasks={},
        remaining_time_seconds=900,
    )

    await repository.save_game(
        "game_concurrent",
        game,
    )

    async def add_score(points: int):
        async def mutation(state: GameState) -> GameState:
            state.remaining_time_seconds += points
            return state

        return await repository.atomic_update_game(
            "game_concurrent",
            mutation,
        )

    await asyncio.gather(
        add_score(5),
        add_score(10),
    )

    result = await repository.get_game(
        "game_concurrent",
    )

    assert result is not None
    assert result.remaining_time_seconds == 915


@pytest.mark.anyio
async def test_redis_watch_detects_external_change(
    redis_client,
):
    key = "game:watch_test"

    await redis_client.set(key, "0")

    async with redis_client.pipeline() as pipe:
        await pipe.watch(key)

        value = await pipe.get(key)

        assert value == "0"

        # Отдельное соединение имитирует
        # изменение состояния другим запросом.
        external_client = redis.Redis(
            host="127.0.0.1",
            port=6379,
            decode_responses=True,
        )

        try:
            await external_client.set(key, "100")

            pipe.multi()
            pipe.set(key, "5")

            with pytest.raises(redis.WatchError):
                await pipe.execute()

        finally:
            await external_client.aclose()


@pytest.mark.anyio
async def test_concurrent_game_updates_retry_after_conflict(
    redis_client,
):
    repository = GameStateRepository(redis_client)

    game = GameState(
        status=GameStatus.RUNNING,
        players={},
        nodes={},
        tasks={},
        remaining_time_seconds=900,
    )

    await repository.save_game(
        "game_retry",
        game,
    )

    first_read = asyncio.Event()
    second_read = asyncio.Event()

    async def add_five(state: GameState) -> GameState:
        first_read.set()
        await second_read.wait()

        state.remaining_time_seconds += 5

        return state

    async def add_ten(state: GameState) -> GameState:
        await first_read.wait()

        second_read.set()

        state.remaining_time_seconds += 10

        return state

    await asyncio.gather(
        repository.atomic_update_game(
            "game_retry",
            add_five,
        ),
        repository.atomic_update_game(
            "game_retry",
            add_ten,
        ),
    )

    result = await repository.get_game("game_retry")

    assert result is not None
    assert result.remaining_time_seconds == 915            


@pytest.mark.anyio
async def test_atomic_update_game_raises_after_max_retries(
    redis_client,
    monkeypatch,
):
    repository = GameStateRepository(redis_client)

    game = GameState(
        status=GameStatus.RUNNING,
        players={},
        nodes={},
        tasks={},
        remaining_time_seconds=900,
    )

    await repository.save_game(
        "game_max_retries",
        game,
    )

    async def always_fail_execute(self):
        raise redis.WatchError

    monkeypatch.setattr(
        redis.client.Pipeline,
        "execute",
        always_fail_execute,
    )

    async def mutation(state: GameState) -> GameState:
        state.remaining_time_seconds += 5
        return state

    with pytest.raises(
        RuntimeError,
        match="GAME_UPDATE_CONFLICT",
    ):
        await repository.atomic_update_game(
            "game_max_retries",
            mutation,
            max_retries=5,
        )    