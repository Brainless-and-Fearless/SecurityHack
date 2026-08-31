from models import RoomStatus
from room_logic import (
    create_room,
    join_room,
    leave_room,
    start_room,
)


def test_create_room():
    room = create_room("room_1", "player_1", nickname="Alice",)

    assert room.id == "room_1"
    assert room.host_id == "player_1"
    assert room.status == RoomStatus.LOBBY
    assert room.player_ids == ["player_1"]


def test_player_can_join_lobby():
    room = create_room("room_1", "player_1", nickname="Alice",)

    join_room(room, "player_2", nickname="Bob",)

    assert room.player_ids == [
        "player_1",
        "player_2",
    ]


def test_room_cannot_start_with_one_player():
    room = create_room("room_1", "player_1", nickname="Alice")

    try:
        start_room(room, "player_1")
        assert False, "Expected start to fail"
    except ValueError as error:
        assert str(error) == "NOT_ENOUGH_PLAYERS"


def test_host_can_start_room():
    room = create_room("room_1", "player_1", nickname="Alice")
    join_room(room, "player_2", nickname="Bob",)

    start_room(room, "player_1")

    assert room.status == RoomStatus.RUNNING


def test_non_host_cannot_start_room():
    room = create_room("room_1", "player_1", nickname="Alice",)
    join_room(room, "player_2", nickname="Bob",)

    try:
        start_room(room, "player_2")
        assert False, "Expected start to fail"
    except ValueError as error:
        assert str(error) == "ONLY_HOST_CAN_START"


def test_host_is_transferred_when_leaving_lobby():
    room = create_room("room_1", "player_1", nickname="Alice",)
    join_room(room, "player_2", nickname="Bob",)

    room_deleted = leave_room(room, "player_1")

    assert room_deleted is False
    assert room.host_id == "player_2"
    assert room.player_ids == ["player_2"]


def test_last_player_leaving_deletes_room():
    room = create_room("room_1", "player_1", nickname="Alice",)

    room_deleted = leave_room(room, "player_1")

    assert room_deleted is True


def test_room_cannot_accept_more_than_max_players():
    room = create_room("room_1", "player_1", nickname="Alice",)

    for player_number in range(2, room.max_players + 1):
        join_room(room, f"player_{player_number}", nickname="Bob",)

    try:
        join_room(room, "player_9", nickname="Bob",)
        assert False, "Expected room to be full"
    except ValueError as error:
        assert str(error) == "ROOM_FULL"


def test_player_cannot_join_room_twice():
    room = create_room("room_1", "player_1", nickname="Alice",)

    join_room(room, "player_2", nickname="Bob",)

    try:
        join_room(room, "player_2", nickname="Bob",)
        assert False, "Expected duplicate join to fail"
    except ValueError as error:
        assert str(error) == "PLAYER_ALREADY_IN_ROOM"


def test_player_cannot_join_running_room():
    room = create_room("room_1", "player_1", nickname="Alice",)
    join_room(room, "player_2", nickname="Bob",)

    start_room(room, "player_1")

    try:
        join_room(room, "player_3", nickname="Bob",)
        assert False, "Expected join to fail"
    except ValueError as error:
        assert str(error) == "ROOM_NOT_JOINABLE"


def test_player_cannot_join_finished_room():
    room = create_room("room_1", "player_1", nickname="Alice",)
    join_room(room, "player_2", nickname="Bob",)

    room.status = RoomStatus.FINISHED

    try:
        join_room(room, "player_3", nickname="Bob",)
        assert False, "Expected join to fail"
    except ValueError as error:
        assert str(error) == "ROOM_NOT_JOINABLE"        


def test_running_room_cannot_be_started_again():
    room = create_room("room_1", "player_1", nickname="Alice",)
    join_room(room, "player_2", nickname="Bob",)

    start_room(room, "player_1")

    try:
        start_room(room, "player_1")
        assert False, "Expected second start to fail"
    except ValueError as error:
        assert str(error) == "ROOM_NOT_IN_LOBBY"        


def test_non_host_leaving_does_not_change_host():
    room = create_room("room_1", "player_1", nickname="Alice",)

    join_room(room, "player_2", nickname="Bob",)
    join_room(room, "player_3", nickname="Bob",)

    room_deleted = leave_room(room, "player_3")

    assert room_deleted is False
    assert room.host_id == "player_1"
    assert room.player_ids == ["player_1", "player_2"]        


def test_player_not_in_room_cannot_leave():
    room = create_room("room_1", "player_1", nickname="Alice",)

    try:
        leave_room(room, "player_2")
        assert False, "Expected leave to fail"
    except ValueError as error:
        assert str(error) == "PLAYER_NOT_IN_ROOM"    


def test_leave_removes_room_nickname_presentation():
    room = create_room("room_1", "player_1", "Alice")
    join_room(room, "player_2", "Bob")

    leave_room(room, "player_2")

    assert "player_2" not in room.player_nicknames


def test_host_transfer_is_deterministic():
    room = create_room("room_1", "player_1", nickname="Alice",)

    join_room(room, "player_2", nickname="Bob",)
    join_room(room, "player_3", nickname="Bob",)

    leave_room(room, "player_1")

    assert room.host_id == "player_2"


def test_create_room_stores_host_nickname():
    room = create_room(
        room_id="ROOM01",
        host_id="player_1",
        nickname="Alice",
    )

    assert room.player_ids == ["player_1"]
    assert room.player_nicknames == {
        "player_1": "Alice",
    }    


def test_join_room_stores_player_nickname():
    room = create_room(
        room_id="ROOM02",
        host_id="player_1",
        nickname="Alice",
    )

    join_room(
        room,
        player_id="player_2",
        nickname="Bob",
    )

    assert room.player_ids == [
        "player_1",
        "player_2",
    ]

    assert room.player_nicknames == {
        "player_1": "Alice",
        "player_2": "Bob",
    }
