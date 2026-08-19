import pytest
import redis.asyncio as redis

from game_service import GameService
from unittest.mock import AsyncMock
from models import GameState, GameStatus, RoomStatus
from redis_repository import RoomRepository, GameStateRepository
from room_service import RoomService


@pytest.fixture
async def redis_client():
    client = redis.Redis(
        host="127.0.0.1",
        port=6379,
        decode_responses=True,
    )

    yield client

    await client.flushdb()
    await client.aclose()


@pytest.fixture
async def room_repository(redis_client):
    return RoomRepository(redis_client)

@pytest.fixture
async def game_repository(redis_client):
    return GameStateRepository(redis_client)

@pytest.fixture
async def game_service(game_repository):
    return GameService(game_repository)


@pytest.fixture
async def room_service(
    room_repository,
    game_service,
):
    return RoomService(
        room_repository,
        game_service,
    )


@pytest.mark.anyio
async def test_create_room_creates_and_persists_room(
    room_service,
    room_repository,
):
    room = await room_service.create_room(
        room_id="room_1",
        host_id="player_1",
        nickname="Alice",
    )

    assert room.id == "room_1"
    assert room.host_id == "player_1"
    assert room.status == RoomStatus.LOBBY
    assert room.player_ids == ["player_1"]

    assert room.player_nicknames == {
        "player_1": "Alice",
    }

    stored_room = await room_repository.get_room("room_1")

    assert stored_room == room


@pytest.mark.anyio
async def test_create_room_adds_room_to_active_rooms(
    room_service,
    room_repository,
):
    await room_service.create_room(
        room_id="room_2",
        host_id="player_1",
        nickname="Alice",
    )

    active_rooms = await room_repository.client.smembers(
        "rooms:active"
    )

    assert "room_2" in active_rooms


@pytest.mark.anyio
async def test_player_can_join_room(
    room_service,
    room_repository,
):
    await room_service.create_room(
        room_id="room_join",
        host_id="player_1",
        nickname="Alice",
    )

    room = await room_service.join_room(
        room_id="room_join",
        player_id="player_2",
        nickname="Bob",
    )

    assert room.id == "room_join"
    assert room.host_id == "player_1"
    assert room.status == RoomStatus.LOBBY

    assert room.player_ids == [
        "player_1",
        "player_2",
    ]

    assert room.player_nicknames == {
        "player_1": "Alice",
        "player_2": "Bob",
    }

    stored_room = await room_repository.get_room(
        "room_join"
    )

    assert stored_room == room


@pytest.mark.anyio
async def test_cannot_join_missing_room(
    room_service,
):
    with pytest.raises(
        ValueError,
        match="ROOM_NOT_FOUND",
    ):
        await room_service.join_room(
            room_id="missing_room",
            player_id="player_2",
            nickname="Bob",
        )


@pytest.mark.anyio
async def test_player_cannot_join_room_twice(
    room_service,
):
    await room_service.create_room(
        room_id="room_duplicate",
        host_id="player_1",
        nickname="Alice",
    )

    await room_service.join_room(
        room_id="room_duplicate",
        player_id="player_2",
        nickname="Bob",
    )

    with pytest.raises(
        ValueError,
        match="PLAYER_ALREADY_IN_ROOM",
    ):
        await room_service.join_room(
            room_id="room_duplicate",
            player_id="player_2",
            nickname="Bob",
        )


@pytest.mark.anyio
async def test_player_cannot_join_full_room(
    room_service,
):
    room = await room_service.create_room(
        room_id="room_full",
        host_id="player_1",
        nickname="Alice",
    )

    for player_number in range(
        2,
        room.max_players + 1,
    ):
        await room_service.join_room(
            room_id="room_full",
            player_id=f"player_{player_number}",
            nickname=f"Player {player_number}",
        )

    with pytest.raises(
        ValueError,
        match="ROOM_FULL",
    ):
        await room_service.join_room(
            room_id="room_full",
            player_id="player_9",
            nickname="Player 9",
        )


@pytest.mark.anyio
async def test_player_cannot_join_running_room(
    room_service,
):
    await room_service.create_room(
        room_id="room_running",
        host_id="player_1",
        nickname="Alice",
    )

    await room_service.join_room(
        room_id="room_running",
        player_id="player_2",
        nickname="Bob",
    )

    await room_service.start_room(
        room_id="room_running",
        player_id="player_1",
    )

    with pytest.raises(
        ValueError,
        match="ROOM_NOT_JOINABLE",
    ):
        await room_service.join_room(
            room_id="room_running",
            player_id="player_3",
            nickname="Charlie",
        )


@pytest.mark.anyio
async def test_host_can_start_room(
    room_service,
    room_repository,
):
    await room_service.create_room(
        room_id="room_start",
        host_id="player_1",
        nickname="Alice",
    )

    await room_service.join_room(
        room_id="room_start",
        player_id="player_2",
        nickname="Bob",
    )

    room = await room_service.start_room(
        room_id="room_start",
        player_id="player_1",
    )

    assert room.status == RoomStatus.RUNNING

    stored_room = await room_repository.get_room(
        "room_start",
    )

    assert stored_room == room


@pytest.mark.anyio
async def test_non_host_cannot_start_room(
    room_service,
):
    await room_service.create_room(
        room_id="room_non_host_start",
        host_id="player_1",
        nickname="Alice",
    )

    await room_service.join_room(
        room_id="room_non_host_start",
        player_id="player_2",
        nickname="Bob",
    )

    with pytest.raises(
        ValueError,
        match="ONLY_HOST_CAN_START",
    ):
        await room_service.start_room(
            room_id="room_non_host_start",
            player_id="player_2",
        )


@pytest.mark.anyio
async def test_room_cannot_start_with_one_player(
    room_service,
):
    await room_service.create_room(
        room_id="room_not_enough",
        host_id="player_1",
        nickname="Alice",
    )

    with pytest.raises(
        ValueError,
        match="NOT_ENOUGH_PLAYERS",
    ):
        await room_service.start_room(
            room_id="room_not_enough",
            player_id="player_1",
        )


@pytest.mark.anyio
async def test_running_room_cannot_be_started_again(
    room_service,
):
    await room_service.create_room(
        room_id="room_already_running",
        host_id="player_1",
        nickname="Alice",
    )

    await room_service.join_room(
        room_id="room_already_running",
        player_id="player_2",
        nickname="Bob",
    )

    await room_service.start_room(
        room_id="room_already_running",
        player_id="player_1",
    )

    with pytest.raises(
        ValueError,
        match="ROOM_NOT_IN_LOBBY",
    ):
        await room_service.start_room(
            room_id="room_already_running",
            player_id="player_1",
        )


@pytest.mark.anyio
async def test_start_game_updates_room_after_game_service_succeeds(
    room_repository,
):
    game_service = AsyncMock()

    game = GameState(
        status=GameStatus.RUNNING,
    )

    game_service.start_game.return_value = (
        "game_123",
        game,
    )

    room_service = RoomService(
        room_repository,
        game_service,
    )

    room = await room_service.create_room(
        room_id="ROOM_START",
        host_id="player_1",
        nickname="Alice",
    )

    await room_service.join_room(
        room_id="ROOM_START",
        player_id="player_2",
        nickname="Bob",
    )

    updated_room = await room_service.start_game(
        room_id="ROOM_START",
        player_id="player_1",
    )

    assert game_service.start_game.await_count == 1

    called_room = (
        game_service.start_game.await_args.args[0]
    )

    assert called_room.id == "ROOM_START"
    assert called_room.player_ids == [
        "player_1",
        "player_2",
    ]

    assert updated_room.status == RoomStatus.RUNNING
    assert updated_room.game_id == "game_123"

    stored_room = await room_repository.get_room(
        "ROOM_START",
    )

    assert stored_room.status == RoomStatus.RUNNING
    assert stored_room.game_id == "game_123"        