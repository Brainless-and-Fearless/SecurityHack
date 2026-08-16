import redis.asyncio as redis

from models import GameState, Room


class RoomRepository:
    def __init__(self, client: redis.Redis):
        self.client = client

    @staticmethod
    def _room_key(room_id: str) -> str:
        return f"room:{room_id}"

    async def save_room(self, room: Room) -> None:
        key = self._room_key(room.id)

        await self.client.set(
            key,
            room.model_dump_json(),
        )

    async def get_room(self, room_id: str) -> Room | None:
        key = self._room_key(room_id)

        data = await self.client.get(key)

        if data is None:
            return None

        if isinstance(data, bytes):
            data = data.decode("utf-8")

        return Room.model_validate_json(data)

    async def delete_room(self, room_id: str) -> None:
        key = self._room_key(room_id)

        await self.client.delete(key)

    async def add_active_room(self, room_id: str) -> None:
        await self.client.sadd(
            "rooms:active",
            room_id,
        )

    async def remove_active_room(self, room_id: str) -> None:
        await self.client.srem(
            "rooms:active",
            room_id,
        )


class GameStateRepository:
    def __init__(self, client: redis.Redis):
        self.client = client

    @staticmethod
    def _game_key(game_id: str) -> str:
        return f"game:{game_id}"

    async def save_game(
        self,
        game_id: str,
        game: GameState,
    ) -> None:
        await self.client.set(
            self._game_key(game_id),
            game.model_dump_json(),
        )

    async def get_game(
        self,
        game_id: str,
    ) -> GameState | None:
        data = await self.client.get(
            self._game_key(game_id)
        )

        if data is None:
            return None

        if isinstance(data, bytes):
            data = data.decode("utf-8")

        return GameState.model_validate_json(data)


    async def delete_game(
        self,
        game_id: str,
    ) -> None:
        await self.client.delete(
            self._game_key(game_id)
        )

    async def atomic_update_game(
        self,
        game_id: str,
        mutation,
        max_retries: int = 5,
    ) -> None:
            
        key = self._game_key(game_id)

        for _ in range(max_retries):
            try:
                async with self.client.pipeline() as pipe:
                    await pipe.watch(key)

                    data = await pipe.get(key)

                    if data is None:
                        raise ValueError("GAME_NOT_FOUND")

                    if isinstance(data, bytes):
                        data = data.decode("utf-8")

                    game = GameState.model_validate_json(data)

                    updated_game = await mutation(game)

                    pipe.multi()

                    pipe.set(
                        key,
                        updated_game.model_dump_json(),
                    )

                    await pipe.execute()

                    return

            except redis.WatchError:
                continue

        raise RuntimeError("GAME_UPDATE_CONFLICT")