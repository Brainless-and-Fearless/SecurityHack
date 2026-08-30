import pytest
import redis.asyncio as redis

from game_logic import MATCH_DURATION_SECONDS
from game_service import GameService
from map_preview import build_room_map_preview
from models import GameStatus, Room
from redis_repository import GameStateRepository
from room_logic import create_room, join_room


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
async def game_repository(redis_client):
    return GameStateRepository(redis_client)


@pytest.fixture
async def game_service(game_repository):
    return GameService(game_repository)


@pytest.mark.anyio
async def test_start_game_creates_and_persists_game(
    game_service,
    game_repository,
):
    room = Room(
        id="ROOM01",
        host_id="player_1",
        player_ids=[
            "player_1",
            "player_2",
        ],
        player_nicknames={
            "player_1": "Alice",
            "player_2": "Bob",
        },
    )

    game_id, game = await game_service.start_game(
        room=room,
    )

    assert game_id

    assert game.status == GameStatus.RUNNING
    assert (
        game.remaining_time_seconds
        == MATCH_DURATION_SECONDS
    )

    assert set(game.players.keys()) == {
        "player_1",
        "player_2",
    }

    assert game.players["player_1"].nickname == "Alice"
    assert game.players["player_2"].nickname == "Bob"

    assert len(game.nodes) > 0

    stored_game = await game_repository.get_game(
        game_id,
    )

    assert stored_game == game


@pytest.mark.anyio
async def test_start_game_requires_two_players(
    game_service,
):
    room = Room(
        id="ROOM_MIN_PLAYERS",
        host_id="player_1",
        player_ids=[
            "player_1",
        ],
        player_nicknames={
            "player_1": "Alice",
        },
    )

    with pytest.raises(
        ValueError,
        match="NOT_ENOUGH_PLAYERS",
    ):
        await game_service.start_game(
            room=room,
        )


@pytest.mark.anyio
async def test_start_game_rejects_missing_player_nickname(
    game_service,
):
    room = Room(
        id="ROOM02",
        host_id="player_1",
        player_ids=[
            "player_1",
            "player_2",
        ],
        player_nicknames={
            "player_1": "Alice",
        },
    )

    with pytest.raises(
        ValueError,
        match="PLAYER_NICKNAME_NOT_FOUND",
    ):
        await game_service.start_game(
            room=room,
        )


@pytest.mark.anyio
async def test_start_game_assigns_starting_nodes_to_all_players(
    game_service,
):
    room = Room(
        id="ROOM03",
        host_id="player_1",
        player_ids=[
            "player_1",
            "player_2",
        ],
        player_nicknames={
            "player_1": "Alice",
            "player_2": "Bob",
        },
    )

    game_id, game = await game_service.start_game(
        room=room,
    )

    player_1_nodes = set(
        game.players["player_1"].owned_node_ids
    )

    player_2_nodes = set(
        game.players["player_2"].owned_node_ids
    )

    assert len(player_1_nodes) == 1
    assert len(player_2_nodes) == 1

    assert player_1_nodes.isdisjoint(
        player_2_nodes
    )

    owned_node_ids = {
        node.id
        for node in game.nodes.values()
        if node.owner_id is not None
    }

    assert owned_node_ids == (
        player_1_nodes | player_2_nodes
    )


@pytest.mark.anyio
async def test_start_game_uses_map_generator_spawn_nodes(
    game_service,
    monkeypatch,
):
    room = Room(
        id="ROOM_SPAWN",
        host_id="player_1",
        player_ids=[
            "player_1",
            "player_2",
        ],
        player_nicknames={
            "player_1": "Alice",
            "player_2": "Bob",
        },
    )

    from map_generator import generate_map

    expected_map = generate_map(
        player_count=2,
        seed=123,
    )

    monkeypatch.setattr(
        "game_service.generate_map",
        lambda player_count, *, seed=None: expected_map,
    )

    game_id, game = await game_service.start_game(
        room=room,
    )

    expected_spawn_nodes = set(
        expected_map.spawn_nodes
    )

    actual_spawn_nodes = {
        node.id
        for node in game.nodes.values()
        if node.owner_id is not None
    }

    assert actual_spawn_nodes == expected_spawn_nodes


@pytest.mark.anyio
async def test_started_game_map_exactly_matches_latest_lobby_preview(
    game_service,
):
    room = create_room(
        room_id="ROOM_PREVIEW",
        host_id="player_1",
        nickname="Alice",
    )

    join_room(room, "player_2", nickname="Bob")
    join_room(room, "player_3", nickname="Carol")
    join_room(room, "player_4", nickname="Dave")

    preview = build_room_map_preview(room)

    _, game = await game_service.start_game(room)

    preview_nodes = {
        node.id: (node.x, node.y)
        for node in preview.nodes
    }
    game_nodes = {
        node.id: (node.x, node.y)
        for node in game.nodes.values()
    }

    preview_edges = {
        tuple(sorted(edge))
        for edge in preview.edges
    }
    game_edges = {
        tuple(sorted((node.id, neighbor_id)))
        for node in game.nodes.values()
        for neighbor_id in node.neighbor_ids
    }

    assert game_nodes == preview_nodes
    assert game_edges == preview_edges
