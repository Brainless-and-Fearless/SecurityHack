from models import Room
from redis_repository import RoomRepository
from room_logic import create_room


from models import Room
from redis_repository import RoomRepository
from room_logic import create_room


class RoomService:
    def __init__(
        self,
        room_repository: RoomRepository,
    ):
        self.room_repository = room_repository

    async def create_room(
        self,
        room_id: str,
        host_id: str,
    ) -> Room:
        room = create_room(
            room_id,
            host_id,
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
    ) -> Room:
        room = await self.room_repository.get_room(room_id)

        if room is None:
            raise ValueError("ROOM_NOT_FOUND")

        from room_logic import join_room

        join_room(room, player_id)

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