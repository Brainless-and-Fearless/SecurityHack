from dataclasses import dataclass

from game_logic import forfeit_player
from models import GameState, Room, RoomStatus
from room_logic import leave_room


@dataclass(frozen=True)
class ForfeitResult:
    room: Room | None
    game_id: str
    game: GameState
    removed_task_ids: list[str]

    @property
    def finished(self) -> bool:
        return self.game.status.value == "finished"


async def forfeit_running_player(
    room_id: str,
    player_id: str,
    *,
    room_repository,
    game_repository,
    game_loop_manager,
    task_manager,
) -> ForfeitResult:
    room = await room_repository.get_room(room_id)

    if room is None:
        raise ValueError("ROOM_NOT_FOUND")
    if room.status != RoomStatus.RUNNING or room.game_id is None:
        raise ValueError("LEAVE_NOT_ALLOWED_AFTER_GAME_START")

    game_id = room.game_id

    async with game_loop_manager.lock(game_id):
        room = await room_repository.get_room(room_id)

        if room is None:
            raise ValueError("ROOM_NOT_FOUND")
        if room.game_id != game_id or room.status != RoomStatus.RUNNING:
            raise ValueError("GAME_NOT_RUNNING")
        if player_id not in room.player_ids:
            raise ValueError("PLAYER_NOT_IN_ROOM")

        game = await game_repository.get_game(game_id)

        if game is None:
            raise ValueError("GAME_STATE_NOT_FOUND")

        removed_task_ids = forfeit_player(game, player_id)
        should_delete_room = leave_room(room, player_id)

        await game_repository.save_game(game_id, game)

        if should_delete_room:
            await room_repository.delete_room(room_id)
            await room_repository.remove_active_room(room_id)
            persisted_room = None
        else:
            await room_repository.save_room(room)
            persisted_room = room

        for task_id in removed_task_ids:
            if task_id in task_manager.tasks:
                task_manager.remove_task(task_id)

    return ForfeitResult(
        room=persisted_room,
        game_id=game_id,
        game=game,
        removed_task_ids=removed_task_ids,
    )
