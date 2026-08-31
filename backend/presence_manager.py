import asyncio
import logging

from game_logic import cancel_attack_state
from models import GameStatus, RoomStatus
from room_state import build_room_state


DISCONNECT_GRACE_SECONDS = 30

ONLINE = "online"
OFFLINE = "offline"

logger = logging.getLogger("securityhack.presence")


class PresenceManager:
    """Process-local player presence and disconnect grace lifecycle."""

    def __init__(
        self,
        room_repository,
        game_repository,
        connection_manager,
        session_registry,
        game_loop_manager,
        task_manager,
        sleep=asyncio.sleep,
    ):
        self.room_repository = room_repository
        self.game_repository = game_repository
        self.connection_manager = connection_manager
        self.session_registry = session_registry
        self.game_loop_manager = game_loop_manager
        self.task_manager = task_manager
        self.sleep = sleep
        self.presence: dict[str, str] = {}
        self.grace_tasks: dict[str, asyncio.Task] = {}
        self.generations: dict[str, int] = {}

    def status(self, player_id: str) -> str | None:
        return self.presence.get(player_id)

    def statuses_for(self, player_ids: list[str]) -> dict[str, str]:
        return {
            player_id: self.presence.get(
                player_id,
                ONLINE
                if player_id in self.connection_manager.connections
                else OFFLINE,
            )
            for player_id in player_ids
        }

    async def mark_online(
        self,
        player_id: str,
        room_id: str,
        *,
        broadcast: bool = True,
    ) -> None:
        self.generations[player_id] = (
            self.generations.get(player_id, 0) + 1
        )
        task = self.grace_tasks.pop(player_id, None)

        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

        self.presence[player_id] = ONLINE

        if broadcast:
            room = await self.room_repository.get_room(room_id)

            if room is not None and player_id in room.player_ids:
                await self.broadcast_room_state(room)

    async def handle_disconnect(
        self,
        player_id: str,
        room_id: str | None,
    ) -> None:
        if room_id is None:
            return

        if player_id in self.connection_manager.connections:
            return

        self.presence[player_id] = OFFLINE

        existing = self.grace_tasks.get(player_id)
        if existing is None or existing.done():
            generation = self.generations.get(player_id, 0) + 1
            self.generations[player_id] = generation
            task = asyncio.create_task(
                self._run_grace(player_id, room_id, generation),
                name=f"disconnect-grace:{player_id}",
            )
            self.grace_tasks[player_id] = task

        try:
            room = await self.room_repository.get_room(room_id)
            if room is not None and player_id in room.player_ids:
                await self.broadcast_room_state(room)
        except Exception:
            logger.exception(
                "Offline presence broadcast failed | player=%s room=%s",
                player_id,
                room_id,
            )

    async def remove_player(self, player_id: str) -> None:
        self.generations[player_id] = (
            self.generations.get(player_id, 0) + 1
        )
        task = self.grace_tasks.pop(player_id, None)

        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

        self.presence.pop(player_id, None)

    async def broadcast_room_state(
        self,
        room,
        *,
        exclude_player_id: str | None = None,
    ) -> None:
        statuses = self.statuses_for(room.player_ids)

        for target_player_id in room.player_ids:
            if target_player_id == exclude_player_id:
                continue

            room_state = build_room_state(
                room=room,
                current_player_id=target_player_id,
                player_statuses=statuses,
            )
            await self.connection_manager.send_to_player(
                target_player_id,
                room_state.model_dump(
                    mode="json",
                    by_alias=True,
                ),
            )

    async def _run_grace(
        self,
        player_id: str,
        room_id: str,
        generation: int,
    ) -> None:
        task = asyncio.current_task()

        try:
            await self.sleep(DISCONNECT_GRACE_SECONDS)
            await self._expire(player_id, room_id, generation)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "Disconnect grace cleanup failed | player=%s room=%s",
                player_id,
                room_id,
            )
        finally:
            if self.grace_tasks.get(player_id) is task:
                self.grace_tasks.pop(player_id, None)

    def _still_offline(
        self,
        player_id: str,
        generation: int,
    ) -> bool:
        return (
            self.generations.get(player_id) == generation
            and self.presence.get(player_id) == OFFLINE
            and player_id not in self.connection_manager.connections
        )

    async def _expire(
        self,
        player_id: str,
        room_id: str,
        generation: int,
    ) -> None:
        if not self._still_offline(player_id, generation):
            return

        room = await self.room_repository.get_room(room_id)

        if room is None or player_id not in room.player_ids:
            return

        if not self._still_offline(player_id, generation):
            return

        if room.status == RoomStatus.LOBBY and room.game_id is None:
            from room_logic import leave_room

            should_delete = leave_room(room, player_id)

            if should_delete:
                await self.room_repository.delete_room(room_id)
                await self.room_repository.remove_active_room(room_id)
            else:
                await self.room_repository.save_room(room)

            self.session_registry.invalidate_for_player(
                room_id,
                player_id,
            )
            self.presence.pop(player_id, None)

            if not should_delete:
                await self.broadcast_room_state(room)
            return

        if room.game_id is None:
            return

        async with self.game_loop_manager.lock(room.game_id):
            if not self._still_offline(player_id, generation):
                return

            game = await self.game_repository.get_game(room.game_id)

            if not self._still_offline(player_id, generation):
                return

            if game is None or game.status != GameStatus.RUNNING:
                return

            task_ids = [
                task_id
                for task_id, task in game.tasks.items()
                if task.player_id == player_id
            ]

            if not task_ids:
                return

            for task_id in task_ids:
                cancel_attack_state(
                    game,
                    player_id,
                    task_id,
                )

            await self.game_repository.save_game(room.game_id, game)

            for task_id in task_ids:
                self.task_manager.remove_task(task_id)

            await self.connection_manager.broadcast_to_room(
                room.id,
                {
                    "type": "GAME_STATE",
                    "game_id": room.game_id,
                    "game": game.model_dump(mode="json"),
                },
            )

    async def stop_all(self) -> None:
        tasks = list(self.grace_tasks.values())

        for task in tasks:
            task.cancel()

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        self.grace_tasks.clear()
