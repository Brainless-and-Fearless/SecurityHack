from models import Room, RoomStatus

MIN_PLAYERS = 2
MAX_PLAYERS = 8


def create_room(room_id: str, host_id: str) -> Room:
    return Room(
        id=room_id,
        host_id=host_id,
        status=RoomStatus.LOBBY,
        player_ids=[host_id],
        max_players=MAX_PLAYERS,
    )


def join_room(room: Room, player_id: str) -> None:
    if room.status != RoomStatus.LOBBY:
        raise ValueError("ROOM_NOT_JOINABLE")
    if player_id in room.player_ids:
        raise ValueError("PLAYER_ALREADY_IN_ROOM")
    if len(room.player_ids) >= room.max_players:
        raise ValueError("ROOM_FULL")
    room.player_ids.append(player_id)


def start_room(room: Room, player_id: str) -> None:
    if room.status != RoomStatus.LOBBY:
        raise ValueError("ROOM_NOT_IN_LOBBY")
    if room.host_id != player_id:
        raise ValueError("ONLY_HOST_CAN_START")
    if len(room.player_ids) < MIN_PLAYERS:
        raise ValueError("NOT_ENOUGH_PLAYERS")
    room.status = RoomStatus.RUNNING
