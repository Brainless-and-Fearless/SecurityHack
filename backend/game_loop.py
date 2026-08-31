import asyncio
import logging

from game_logic import tick_game
from models import GameStatus
from network_models import GameFinishedMessage


GAME_TICK_INTERVAL_SECONDS = 1.0

logger = logging.getLogger("securityhack.game_loop")


class GameLoopManager:
    def __init__(
        self,
        game_repository,
        connection_manager,
        room_repository=None,
        task_manager=None,
        sleep=asyncio.sleep,
    ):
        self.game_repository = game_repository
        self.connection_manager = connection_manager
        self.room_repository = room_repository
        self.task_manager = task_manager
        self.sleep = sleep
        self.tasks: dict[str, asyncio.Task] = {}
        self.locks: dict[str, asyncio.Lock] = {}

    def lock(self, game_id: str) -> asyncio.Lock:
        lock = self.locks.get(game_id)

        if lock is None:
            lock = asyncio.Lock()
            self.locks[game_id] = lock

        return lock

    def start(
        self,
        room_id: str,
        game_id: str,
    ) -> asyncio.Task:
        existing_task = self.tasks.get(game_id)

        if (
            existing_task is not None
            and not existing_task.done()
        ):
            return existing_task

        task = asyncio.create_task(
            self._run(room_id, game_id),
            name=f"game-loop:{game_id}",
        )
        self.tasks[game_id] = task

        return task

    async def _run(
        self,
        room_id: str,
        game_id: str,
    ) -> None:
        try:
            while True:
                await self.sleep(
                    GAME_TICK_INTERVAL_SECONDS
                )

                try:
                    should_continue = await self._tick_once(
                        room_id,
                        game_id,
                    )
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception(
                        "Game loop tick failed | room=%s | game=%s",
                        room_id,
                        game_id,
                    )
                    continue

                if not should_continue:
                    return
        finally:
            current_task = asyncio.current_task()

            if self.tasks.get(game_id) is current_task:
                del self.tasks[game_id]

    async def _tick_once(
        self,
        room_id: str,
        game_id: str,
    ) -> bool:
        async with self.lock(game_id):
            if self.room_repository is not None:
                room = await self.room_repository.get_room(
                    room_id
                )

                if room is None:
                    return False

            game = await self.game_repository.get_game(
                game_id
            )

            if (
                game is None
                or game.status != GameStatus.RUNNING
            ):
                return False

            active_task_ids = list(game.tasks)

            tick_game(game)

            await self.game_repository.save_game(
                game_id,
                game,
            )

            if (
                game.status == GameStatus.FINISHED
                and self.task_manager is not None
            ):
                for task_id in active_task_ids:
                    if task_id in self.task_manager.tasks:
                        self.task_manager.remove_task(task_id)

            await self.connection_manager.broadcast_to_room(
                room_id,
                {
                    "type": "GAME_STATE",
                    "game_id": game_id,
                    "game": game.model_dump(mode="json"),
                },
            )

            if game.status == GameStatus.FINISHED:
                finished_message = GameFinishedMessage(
                    type="GAME_FINISHED",
                    game_id=game_id,
                    winner_id=game.winner_id,
                    scores={
                        player_id: player.score
                        for player_id, player in game.players.items()
                    },
                )

                await self.connection_manager.broadcast_to_room(
                    room_id,
                    finished_message.model_dump(mode="json"),
                )

            return game.status == GameStatus.RUNNING

    async def stop(self, game_id: str) -> None:
        task = self.tasks.get(game_id)

        if task is None:
            return

        task.cancel()
        await asyncio.gather(
            task,
            return_exceptions=True,
        )

    async def stop_all(self) -> None:
        tasks = list(self.tasks.values())

        for task in tasks:
            task.cancel()

        if tasks:
            await asyncio.gather(
                *tasks,
                return_exceptions=True,
            )
