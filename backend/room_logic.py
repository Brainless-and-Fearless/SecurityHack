from models import Room, RoomStatus


MIN_PLAYERS = 2
MAX_PLAYERS = 8


def create_room(
    room_id: str,
    host_id: str,
    nickname: str,
) -> Room:
    room = Room(
        id=room_id,
        host_id=host_id,
        status=RoomStatus.LOBBY,
        player_ids=[host_id],
        player_nicknames={
            host_id: nickname,
        },
    )

    return room


def join_room(
    room: Room,
    player_id: str,
    nickname: str,
) -> None:
    if room.status != RoomStatus.LOBBY:
        raise ValueError("ROOM_NOT_JOINABLE")

    if player_id in room.player_ids:
        raise ValueError("PLAYER_ALREADY_IN_ROOM")

    if len(room.player_ids) >= room.max_players:
        raise ValueError("ROOM_FULL")

    room.player_ids.append(player_id)
    room.player_nicknames[player_id] = nickname    


def leave_room(
    room: Room,
    player_id: str,
) -> bool:
    """
    Remove a player.

    Returns True when the room should be deleted
    because no players remain.
    """

    if player_id not in room.player_ids:
        raise ValueError("PLAYER_NOT_IN_ROOM")

    room.player_ids.remove(player_id)
    room.player_nicknames.pop(player_id, None)

    if not room.player_ids:
        return True

    if room.host_id == player_id:
        room.host_id = room.player_ids[0]

    return False


def start_room(
    room: Room,
    player_id: str,
) -> None:
    if room.status != RoomStatus.LOBBY:
        raise ValueError("ROOM_NOT_IN_LOBBY")

    if room.host_id != player_id:
        raise ValueError("ONLY_HOST_CAN_START")

    if len(room.player_ids) < MIN_PLAYERS:
        raise ValueError("NOT_ENOUGH_PLAYERS")

    room.status = RoomStatus.RUNNING
