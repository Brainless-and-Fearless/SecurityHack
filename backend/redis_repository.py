import redis.asyncio as redis
from models import Room


class RoomRepository:
    def __init__(self, client: redis.Redis):
        self.client = client

    @staticmethod
    def _room_key(room_id: str) -> str:
        return f"room:{room_id}"

    async def save_room(self, room: Room) -> None:
        await self.client.set(self._room_key(room.id), room.model_dump_json())

    async def get_room(self, room_id: str) -> Room | None:
        data = await self.client.get(self._room_key(room_id))
        if data is None:
            return None
        if isinstance(data, bytes):
            data = data.decode("utf-8")
        return Room.model_validate_json(data)

    async def add_active_room(self, room_id: str) -> None:
        await self.client.sadd("rooms:active", room_id)
