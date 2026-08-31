from models import Room
from network_models import RoomPlayerState, RoomStateMessage
from map_preview import build_room_map_preview

def build_room_state(
    room: Room,
    current_player_id: str,
    player_statuses: dict[str, str] | None = None,
) -> RoomStateMessage:
    if current_player_id not in room.player_ids:
        raise ValueError("PLAYER_NOT_IN_ROOM")

    players = []

    for player_id in room.player_ids:
        nickname = room.player_nicknames.get(player_id)

        if nickname is None:
            raise ValueError(
                "PLAYER_NICKNAME_NOT_FOUND"
            )

        players.append(
            RoomPlayerState(
                id=player_id,
                name=nickname,
                is_host=player_id == room.host_id,
                status=(player_statuses or {}).get(
                    player_id,
                    "online",
                ),
            )
        )

    current_player = next(
        player
        for player in players
        if player.id == current_player_id
    )

    return RoomStateMessage(
        type="ROOM_STATE",
        room_code=room.id,
        you=current_player,
        players=players,
        map_preview=build_room_map_preview(room),
    )
