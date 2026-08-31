import os
import secrets
import logging
import redis.asyncio as redis

from game_service import GameService
from game_loop import GameLoopManager
from room_state import build_room_state
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from connection_manager import ConnectionManager
from task_manager import TaskManager
from task_pool import TASK_POOL
from redis_repository import (
    GameStateRepository,
    RoomRepository,
)
from game_logic import (
    cancel_attack,
    get_upgrade_cost,
    start_attack,
    resolve_attack,
    upgrade_node,
)
from models import GameStatus


from room_id import generate_unique_room_id
from room_service import RoomService
from network_models import (
    CreateRoomMessage,
    JoinRoomMessage,
    StartGameMessage,
    RoomCreatedMessage,
    RoomJoinedMessage,
    ErrorMessage,
    AttackNodeMessage,
    AnswerTaskMessage,
    CancelAttackMessage,
    UpgradeNodeMessage,
    AttackStartedMessage,
    AttackResolvedMessage,
    AttackCancelledMessage,
    NodeUpgradedMessage,
)

def generate_player_id() -> str:
    return secrets.token_hex(8)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("securityhack")

@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_url = os.getenv(
        "REDIS_URL",
        "redis://127.0.0.1:6379",
    )

    redis_client = redis.Redis.from_url(
        redis_url,
        decode_responses=True,
    )

    room_repository = RoomRepository(
        redis_client
    )

    game_repository = GameStateRepository(
        redis_client
    )

    game_service = GameService(
        game_repository
    )

    room_service = RoomService(
        room_repository,
        game_service
    )

    task_manager = TaskManager(TASK_POOL)

    connection_manager = ConnectionManager()

    game_loop_manager = GameLoopManager(
        game_repository,
        connection_manager,
        room_repository,
        task_manager=task_manager,
    )

    app.state.redis = redis_client
    app.state.room_repository = room_repository
    app.state.game_repository = game_repository
    app.state.game_service = game_service
    app.state.room_service = room_service
    app.state.task_manager = task_manager
    app.state.connection_manager = connection_manager
    app.state.game_loop_manager = game_loop_manager

    logger.info("SecurityHack API started")

    try:
        yield
    finally:
        await game_loop_manager.stop_all()
        await redis_client.aclose()
        logger.info("SecurityHack API stopped")


app = FastAPI(
    title="SecurityHack API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "SecurityHack FastAPI server is running",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    client = "unknown"

    if websocket.client:
        client = (
            f"{websocket.client.host}:"
            f"{websocket.client.port}"
        )

    player_id = generate_player_id()
    current_room_id: str | None = None

    logger.info(
        "WebSocket connected: %s | player=%s",
        client,
        player_id,
    )

    room_service = websocket.app.state.room_service
    connection_manager = (
        websocket.app.state.connection_manager
    )
    game_repository = (
        websocket.app.state.game_repository
    )
    game_loop_manager = (
        websocket.app.state.game_loop_manager
    )

    async def send_error(
        code: str,
        message: str,
        request_id: str | None = None,
    ) -> None:
        response = ErrorMessage(
            type="ERROR",
            request_id=request_id,
            code=code,
            message=message,
        )

        await websocket.send_json(
            response.model_dump(mode="json")
        )
    try:
        while True:
            message = await websocket.receive_json()

            message_type = message.get("type")

            # ---------------------------------------------------------
            # CREATE_ROOM
            # ---------------------------------------------------------
            if message_type == "CREATE_ROOM":
                create_message = (
                    CreateRoomMessage.model_validate(
                        message
                    )
                )

                room_id = (
                    await generate_unique_room_id(
                        websocket.app.state.redis
                    )
                )

                room = await room_service.create_room(
                    room_id=room_id,
                    host_id=player_id,
                    nickname=create_message.nickname,
                )

                await connection_manager.connect(
                    player_id,
                    room.id,
                    websocket,
                )

                current_room_id = room.id

                room_state = build_room_state(
                    room=room,
                    current_player_id=player_id,
                )

                await connection_manager.broadcast_to_room(
                    room.id,
                    room_state.model_dump(
                        mode="json",
                        by_alias=True,
                    ),
                )

                response = RoomCreatedMessage(
                    type="ROOM_CREATED",
                    request_id=create_message.request_id,
                    room_id=room.id,
                    player_id=player_id,
                    is_host=True,
                )

                await websocket.send_json(
                    response.model_dump(mode="json")
                )

                continue

            # ---------------------------------------------------------
            # JOIN_ROOM
            # ---------------------------------------------------------
            if message_type == "JOIN_ROOM":
                join_message = (
                    JoinRoomMessage.model_validate(
                        message
                    )
                )

                room = await room_service.join_room(
                    room_id=join_message.room_id,
                    player_id=player_id,
                    nickname=join_message.nickname,
                )

                await connection_manager.connect(
                    player_id,
                    room.id,
                    websocket,
                )

                current_room_id = room.id

                for target_player_id in room.player_ids:
                    room_state = build_room_state(
                        room=room,
                        current_player_id=target_player_id,
                    )

                    await connection_manager.send_to_player(
                        target_player_id,
                        room_state.model_dump(
                            mode="json",
                            by_alias=True,
                        ),
                    )

                response = RoomJoinedMessage(
                    type="ROOM_JOINED",
                    request_id=join_message.request_id,
                    room_id=room.id,
                    player_id=player_id,
                    is_host=room.host_id == player_id,
                )

                await websocket.send_json(
                    response.model_dump(mode="json")
                )

                continue

            # ---------------------------------------------------------
            # START_GAME
            # ---------------------------------------------------------
            if message_type == "START_GAME":
                start_message = (
                    StartGameMessage.model_validate(
                        message
                    )
                )

                if current_room_id is None:
                    await send_error(
                        code="NOT_IN_ROOM",
                        message="Player is not in a room.",
                        request_id=start_message.request_id,
                    )
                    continue

                room = await room_service.start_game(
                    room_id=current_room_id,
                    player_id=player_id,
                )

                await connection_manager.broadcast_to_room(
                    room.id,
                    {
                        "type": "GAME_STARTED",
                    },
                )

                game = await game_repository.get_game(
                    room.game_id
                )

                if game is None:
                    raise ValueError(
                        "GAME_STATE_NOT_FOUND"
                    )

                await connection_manager.broadcast_to_room(
                    room.id,
                    {
                        "type": "GAME_STATE",
                        "game_id": room.game_id,
                        "game": game.model_dump(
                            mode="json"
                        ),
                    },
                )

                game_loop_manager.start(
                    room.id,
                    room.game_id,
                )

                continue

            if message_type == "ATTACK_NODE":
                attack_message = AttackNodeMessage.model_validate(
                    message
                )

                if current_room_id is None:
                    await send_error(
                        code="NOT_IN_ROOM",
                        message="Player is not in a room.",
                        request_id=attack_message.request_id,
                    )
                    continue

                room = await websocket.app.state.room_repository.get_room(
                    current_room_id
                )

                if room is None:
                    await send_error(
                        code="ROOM_NOT_FOUND",
                        message="Room not found.",
                        request_id=attack_message.request_id,
                    )
                    continue

                if room.game_id is None:
                    await send_error(
                        code="GAME_NOT_STARTED",
                        message="Game has not started.",
                        request_id=attack_message.request_id,
                    )
                    continue

                async with game_loop_manager.lock(
                    room.game_id
                ):
                    game = await game_repository.get_game(
                        room.game_id
                    )

                    if game is None:
                        await send_error(
                            code="GAME_STATE_NOT_FOUND",
                            message="Game state not found.",
                            request_id=attack_message.request_id,
                        )
                        continue

                    try:
                        task = start_attack(
                            game,
                            player_id,
                            attack_message.node_id,
                            task_manager=websocket.app.state.task_manager,
                        )
                    except ValueError as exc:
                        await send_error(
                            code=str(exc),
                            message=str(exc),
                            request_id=attack_message.request_id,
                        )
                        continue

                    await game_repository.save_game(
                        room.game_id,
                        game,
                    )

                    response = AttackStartedMessage(
                        type="ATTACK_STARTED",
                        request_id=attack_message.request_id,
                        node_id=task.node_id,
                        task=task,
                    )

                    await websocket.send_json(
                        response.model_dump(mode="json")
                    )

                    await connection_manager.broadcast_to_room(
                        room.id,
                        {
                            "type": "GAME_STATE",
                            "game_id": room.game_id,
                            "game": game.model_dump(
                                mode="json"
                            ),
                        },
                    )

                continue


            if message_type == "CANCEL_ATTACK":
                cancel_message = CancelAttackMessage.model_validate(
                    message
                )

                if current_room_id is None:
                    await send_error(
                        code="NOT_IN_ROOM",
                        message="Player is not in a room.",
                        request_id=cancel_message.request_id,
                    )
                    continue

                room = await websocket.app.state.room_repository.get_room(
                    current_room_id
                )

                if room is None:
                    await send_error(
                        code="ROOM_NOT_FOUND",
                        message="Room not found.",
                        request_id=cancel_message.request_id,
                    )
                    continue

                if room.game_id is None:
                    await send_error(
                        code="GAME_NOT_STARTED",
                        message="Game has not started.",
                        request_id=cancel_message.request_id,
                    )
                    continue

                async with game_loop_manager.lock(
                    room.game_id
                ):
                    game = await game_repository.get_game(
                        room.game_id
                    )

                    if game is None:
                        await send_error(
                            code="GAME_STATE_NOT_FOUND",
                            message="Game state not found.",
                            request_id=cancel_message.request_id,
                        )
                        continue

                    task = game.tasks.get(
                        cancel_message.task_id
                    )

                    try:
                        cancel_attack(
                            game,
                            player_id,
                            cancel_message.task_id,
                            websocket.app.state.task_manager,
                        )
                    except ValueError as exc:
                        await send_error(
                            code=str(exc),
                            message=str(exc),
                            request_id=cancel_message.request_id,
                        )
                        continue

                    await game_repository.save_game(
                        room.game_id,
                        game,
                    )

                    response = AttackCancelledMessage(
                        type="ATTACK_CANCELLED",
                        request_id=cancel_message.request_id,
                        task_id=cancel_message.task_id,
                        node_id=task.node_id,
                    )

                    await websocket.send_json(
                        response.model_dump(mode="json")
                    )

                    await connection_manager.broadcast_to_room(
                        room.id,
                        {
                            "type": "GAME_STATE",
                            "game_id": room.game_id,
                            "game": game.model_dump(
                                mode="json"
                            ),
                        },
                    )

                continue


            if message_type == "UPGRADE_NODE":
                upgrade_message = UpgradeNodeMessage.model_validate(
                    message
                )

                if current_room_id is None:
                    await send_error(
                        code="NOT_IN_ROOM",
                        message="Player is not in a room.",
                        request_id=upgrade_message.request_id,
                    )
                    continue

                room = await websocket.app.state.room_repository.get_room(
                    current_room_id
                )

                if room is None:
                    await send_error(
                        code="ROOM_NOT_FOUND",
                        message="Room not found.",
                        request_id=upgrade_message.request_id,
                    )
                    continue

                if room.game_id is None:
                    await send_error(
                        code="GAME_NOT_STARTED",
                        message="Game has not started.",
                        request_id=upgrade_message.request_id,
                    )
                    continue

                async with game_loop_manager.lock(
                    room.game_id
                ):
                    game = await game_repository.get_game(
                        room.game_id
                    )

                    if game is None:
                        await send_error(
                            code="GAME_STATE_NOT_FOUND",
                            message="Game state not found.",
                            request_id=upgrade_message.request_id,
                        )
                        continue

                    node = game.nodes.get(upgrade_message.node_id)
                    from_level = (
                        node.defence_level
                        if node is not None
                        else None
                    )

                    try:
                        to_level = upgrade_node(
                            game,
                            player_id,
                            upgrade_message.node_id,
                        )
                    except ValueError as exc:
                        await send_error(
                            code=str(exc),
                            message=str(exc),
                            request_id=upgrade_message.request_id,
                        )
                        continue

                    cost = get_upgrade_cost(from_level)

                    await game_repository.save_game(
                        room.game_id,
                        game,
                    )

                    response = NodeUpgradedMessage(
                        type="NODE_UPGRADED",
                        request_id=upgrade_message.request_id,
                        node_id=upgrade_message.node_id,
                        from_level=from_level,
                        to_level=to_level,
                        cost=cost,
                    )

                    await websocket.send_json(
                        response.model_dump(mode="json")
                    )

                    await connection_manager.broadcast_to_room(
                        room.id,
                        {
                            "type": "GAME_STATE",
                            "game_id": room.game_id,
                            "game": game.model_dump(
                                mode="json"
                            ),
                        },
                    )

                continue


            if message_type == "ANSWER_TASK":
                answer_message = AnswerTaskMessage.model_validate(
                    message
                )

                if current_room_id is None:
                    await send_error(
                        code="NOT_IN_ROOM",
                        message="Player is not in a room.",
                        request_id=answer_message.request_id,
                    )
                    continue

                room = await websocket.app.state.room_repository.get_room(
                    current_room_id
                )

                if room is None:
                    await send_error(
                        code="ROOM_NOT_FOUND",
                        message="Room not found.",
                        request_id=answer_message.request_id,
                    )
                    continue

                if room.game_id is None:
                    await send_error(
                        code="GAME_NOT_STARTED",
                        message="Game has not started.",
                        request_id=answer_message.request_id,
                    )
                    continue

                async with game_loop_manager.lock(
                    room.game_id
                ):
                    game = await game_repository.get_game(
                        room.game_id
                    )

                    if game is None:
                        await send_error(
                            code="GAME_STATE_NOT_FOUND",
                            message="Game state not found.",
                            request_id=answer_message.request_id,
                        )
                        continue

                    task_manager = websocket.app.state.task_manager

                    try:
                        if game.status != GameStatus.RUNNING:
                            raise ValueError("GAME_NOT_RUNNING")

                        task = task_manager.get_task(
                            answer_message.task_id
                        )

                        node_id = task.node_id

                        resolution = task_manager.check_answer(
                            answer_message.task_id,
                            player_id,
                            answer_message.answer,
                        )

                        score_change = resolve_attack(
                            game,
                            player_id,
                            answer_message.task_id,
                            resolution,
                            task_manager,
                        )

                    except ValueError as exc:
                        await send_error(
                            code=str(exc),
                            message=str(exc),
                            request_id=answer_message.request_id,
                        )
                        continue

                    await game_repository.save_game(
                        room.game_id,
                        game,
                    )

                    response = AttackResolvedMessage(
                        type="ATTACK_RESOLVED",
                        request_id=answer_message.request_id,
                        node_id=node_id,
                        success=resolution.success,
                        score_change=score_change,
                        theory=resolution.theory,
                        explanation=resolution.explanation,
                    )

                    await websocket.send_json(
                        response.model_dump(mode="json")
                    )

                    await connection_manager.broadcast_to_room(
                        room.id,
                        {
                            "type": "GAME_STATE",
                            "game_id": room.game_id,
                            "game": game.model_dump(
                                mode="json"
                            ),
                        },
                    )

                continue
            
            # ---------------------------------------------------------
            # UNKNOWN MESSAGE
            # ---------------------------------------------------------
            await send_error(
                code="UNKNOWN_MESSAGE",
                message="Unsupported message type.",
                request_id=message.get(
                    "request_id"
                ),
            )

    except WebSocketDisconnect:
        logger.info(
            "WebSocket disconnected: %s | player=%s",
            client,
            player_id,
        )

    except ValueError as exc:
        logger.exception(
            "WebSocket validation error: %s | player=%s",
            client,
            player_id,
        )

        try:
            await send_error(
                code=str(exc),
                message=str(exc),
            )
        except Exception:
            pass

    except Exception:
        logger.exception(
            "WebSocket error: %s | player=%s",
            client,
            player_id,
        )

        try:
            await websocket.close(
                code=1011
            )
        except Exception:
            pass
