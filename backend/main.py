import os
import secrets
import logging
import redis.asyncio as redis

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from connection_manager import ConnectionManager
from network_models import CreateRoomMessage, RoomCreatedMessage
from redis_repository import RoomRepository
from room_id import generate_unique_room_id
from room_service import RoomService
from network_models import (
    CreateRoomMessage,
    JoinRoomMessage,
    RoomCreatedMessage,
    RoomJoinedMessage,
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

    room_repository = RoomRepository(redis_client)

    connection_manager = ConnectionManager()

    room_service = RoomService(
        room_repository,
    )

    app.state.redis = redis_client
    app.state.room_repository = room_repository
    app.state.connection_manager = connection_manager
    app.state.room_service = room_service

    logger.info("SecurityHack API started")

    try:
        yield
    finally:
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
        client = f"{websocket.client.host}:{websocket.client.port}"

    player_id = generate_player_id()

    logger.info(
        "WebSocket connected: %s | player=%s",
        client,
        player_id,
    )

    room_service = websocket.app.state.room_service

    try:
        while True:
            message = await websocket.receive_json()

            if message.get("type") == "CREATE_ROOM":
                create_message = CreateRoomMessage.model_validate(
                    message
                )

                room_id = await generate_unique_room_id(
                    websocket.app.state.redis
                )

                room = await room_service.create_room(
                    room_id=room_id,
                    host_id=player_id,
                )

                await websocket.app.state.connection_manager.connect(
                    player_id,
                    room.id,
                    websocket,
                )

                await websocket.app.state.connection_manager.broadcast_to_room(
                    room.id,
                    {
                        "type": "ROOM_STATE",
                        "room": room.model_dump(mode="json"),
                    },
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

            if message.get("type") == "JOIN_ROOM":
                join_message = JoinRoomMessage.model_validate(
                    message
                )

                room = await room_service.join_room(
                    room_id=join_message.room_id,
                    player_id=player_id,
                )

                await websocket.app.state.connection_manager.connect(
                    player_id,
                    room.id,
                    websocket,
                )

                await websocket.app.state.connection_manager.broadcast_to_room(
                    room.id,
                    {
                        "type": "ROOM_STATE",
                        "room": room.model_dump(mode="json"),
                    },
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


            await websocket.send_json(
                {
                    "type": "ERROR",
                    "code": "UNKNOWN_MESSAGE",
                    "message": "Unsupported message type.",
                }
            )

    except WebSocketDisconnect:
        logger.info(
            "WebSocket disconnected: %s | player=%s",
            client,
            player_id,
        )

    except Exception:
        logger.exception(
            "WebSocket error: %s | player=%s",
            client,
            player_id,
        )

        try:
            await websocket.close(code=1011)
        except Exception:
            pass