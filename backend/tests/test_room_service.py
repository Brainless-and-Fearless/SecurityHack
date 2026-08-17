import pytest
import redis.asyncio as redis

from models import RoomStatus
from redis_repository import RoomRepository
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
async def room_service(
    room_repository,
):
    return RoomService(
        room_repository,
    )


@pytest.mark.anyio
async def test_create_room_creates_and_persists_room(
    room_service,
    room_repository,
):
    room = await room_service.create_room(
        room_id="room_1",
        host_id="player_1",
    )

    assert room.id == "room_1"
    assert room.host_id == "player_1"
    assert room.status == RoomStatus.LOBBY
    assert room.player_ids == ["player_1"]

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
    )

    room = await room_service.join_room(
        room_id="room_join",
        player_id="player_2",
    )

    assert room.id == "room_join"
    assert room.host_id == "player_1"
    assert room.status == RoomStatus.LOBBY
    assert room.player_ids == [
        "player_1",
        "player_2",
    ]

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
        )    


@pytest.mark.anyio
async def test_player_cannot_join_room_twice(
    room_service,
):
    await room_service.create_room(
        room_id="room_duplicate",
        host_id="player_1",
    )

    await room_service.join_room(
        room_id="room_duplicate",
        player_id="player_2",
    )

    with pytest.raises(
        ValueError,
        match="PLAYER_ALREADY_IN_ROOM",
    ):
        await room_service.join_room(
            room_id="room_duplicate",
            player_id="player_2",
        )


@pytest.mark.anyio
async def test_player_cannot_join_full_room(
    room_service,
    room_repository,
):
    room = await room_service.create_room(
        room_id="room_full",
        host_id="player_1",
    )

    for player_number in range(
        2,
        room.max_players + 1,
    ):
        await room_service.join_room(
            room_id="room_full",
            player_id=f"player_{player_number}",
        )

    with pytest.raises(
        ValueError,
        match="ROOM_FULL",
    ):
        await room_service.join_room(
            room_id="room_full",
            player_id="player_9",
        )


@pytest.mark.anyio
async def test_host_can_start_room(
    room_service,
    room_repository,
):
    await room_service.create_room(
        room_id="room_start",
        host_id="player_1",
    )

    await room_service.join_room(
        room_id="room_start",
        player_id="player_2",
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
    )

    await room_service.join_room(
        room_id="room_non_host_start",
        player_id="player_2",
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
    )

    await room_service.join_room(
        room_id="room_already_running",
        player_id="player_2",
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
       