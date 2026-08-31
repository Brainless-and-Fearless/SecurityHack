from models import Room
from redis_repository import RoomRepository
from room_logic import create_room
from room_logic import leave_room as remove_player_from_room
from game_service import GameService
from models import Room, RoomStatus
from redis_repository import RoomRepository
from room_logic import create_room


class RoomService:
    def __init__(
        self,
        room_repository: RoomRepository,
        game_service: GameService,
    ):
        self.room_repository = room_repository
        self.game_service = game_service


    async def create_room(
        self,
        room_id: str,
        host_id: str,
        nickname: str,
    ) -> Room:
        room = create_room(
            room_id,
            host_id,
            nickname,
        )

        await self.room_repository.save_room(room)

        await self.room_repository.add_active_room(
            room.id,
        )

        return room


    async def join_room(
        self,
        room_id: str,
        player_id: str,
        nickname: str,
    ) -> Room:
        room = await self.room_repository.get_room(room_id)

        if room is None:
            raise ValueError("ROOM_NOT_FOUND")

        from room_logic import join_room

        join_room(room, player_id, nickname)

        await self.room_repository.save_room(room)

        return room


    async def start_room(
        self,
        room_id: str,
        player_id: str,
    ) -> Room:
        room = await self.room_repository.get_room(room_id)

        if room is None:
            raise ValueError("ROOM_NOT_FOUND")

        from room_logic import start_room

        start_room(room, player_id)

        await self.room_repository.save_room(room)

        return room


    async def start_game(
        self,
        room_id: str,
        player_id: str,
    ) -> Room:
        room = await self.room_repository.get_room(
            room_id,
        )

        if room is None:
            raise ValueError("ROOM_NOT_FOUND")

        if room.host_id != player_id:
            raise ValueError("ONLY_HOST_CAN_START")

        if room.status != RoomStatus.LOBBY:
            raise ValueError("ROOM_NOT_IN_LOBBY")

        if len(room.player_ids) < 2:
            raise ValueError("NOT_ENOUGH_PLAYERS")

        game_id, game = await self.game_service.start_game(
            room,
        )

        room.game_id = game_id
        room.status = RoomStatus.RUNNING

        await self.room_repository.save_room(
            room,
        )

        return room


    async def leave_room(
        self,
        room_id: str,
        player_id: str,
    ) -> Room | None:
        room = await self.room_repository.get_room(room_id)

        if room is None:
            raise ValueError("ROOM_NOT_FOUND")

        if (
            room.status != RoomStatus.LOBBY
            or room.game_id is not None
        ):
            raise ValueError(
                "LEAVE_NOT_ALLOWED_AFTER_GAME_START"
            )

        should_delete = remove_player_from_room(
            room,
            player_id,
        )

        if should_delete:
            await self.room_repository.delete_room(room.id)
            await self.room_repository.remove_active_room(room.id)
            return None

        await self.room_repository.save_room(room)
        return room
