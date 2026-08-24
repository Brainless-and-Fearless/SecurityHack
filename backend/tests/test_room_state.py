import pytest

from models import Room, RoomStatus
from room_state import build_room_state


def test_build_room_state_for_player():
    room = Room(
        id="ABC623",
        host_id="player_1",
        status=RoomStatus.LOBBY,
        player_ids=[
            "player_1",
            "player_2",
        ],
        player_nicknames={
            "player_1": "Alice",
            "player_2": "Bob",
        },
    )

    message = build_room_state(
        room=room,
        current_player_id="player_2",
    )

    assert message.type == "ROOM_STATE"

    assert message.room_code == "ABC623"

    assert message.you.id == "player_2"
    assert message.you.name == "Bob"
    assert message.you.is_host is False

    assert len(message.players) == 2

    alice = next(
        player
        for player in message.players
        if player.id == "player_1"
    )

    bob = next(
        player
        for player in message.players
        if player.id == "player_2"
    )

    assert alice.name == "Alice"
    assert alice.is_host is True

    assert bob.name == "Bob"
    assert bob.is_host is False


def test_build_room_state_requires_player_in_room():
    room = Room(
        id="ABC123",
        host_id="player_1",
        status=RoomStatus.LOBBY,
        player_ids=["player_1"],
        player_nicknames={
            "player_1": "Alice",
        },
    )

    with pytest.raises(
        ValueError,
        match="PLAYER_NOT_IN_ROOM",
    ):
        build_room_state(
            room=room,
            current_player_id="player_999",
        )


def test_build_room_state_contains_stable_map_preview():
    room = Room(
        id="ABC234",
        host_id="player_1",
        player_ids=[
            "player_1",
            "player_2",
        ],
        player_nicknames={
            "player_1": "Alice",
            "player_2": "Bob",
        },
        map_preview_seed=123456,
    )

    host_state = build_room_state(
        room,
        "player_1",
    )

    player_state = build_room_state(
        room,
        "player_2",
    )

    assert host_state.map_preview is not None
    assert host_state.map_preview == (
        player_state.map_preview
    )        