import logging
import os
import secrets
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from connection_manager import ConnectionManager
from network_models import (
    CreateRoomMessage,
    JoinRoomMessage,
    StartGameMessage,
    RoomCreatedMessage,
    RoomJoinedMessage,
)
from redis_repository import RoomRepository
from room_id import generate_unique_room_id
from room_service import RoomService


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("securityhack")


def generate_player_id() -> str:
    return secrets.token_hex(8)


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_url = os.getenv("REDIS_URL", "redis://127.0.0.1:6379")
    redis_client = redis.Redis.from_url(redis_url, decode_responses=True)

    app.state.redis = redis_client
    app.state.room_repository = RoomRepository(redis_client)
    app.state.room_service = RoomService(app.state.room_repository)
    app.state.connection_manager = ConnectionManager()

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
    return {"status": "ok", "message": "SecurityHack FastAPI server is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    player_id = generate_player_id()
    room_service = websocket.app.state.room_service
    manager = websocket.app.state.connection_manager

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            try:
                if message_type == "CREATE_ROOM":
                    request = CreateRoomMessage.model_validate(message)
                    room_id = await generate_unique_room_id(websocket.app.state.redis)
                    room = await room_service.create_room(room_id, player_id)

                    await manager.connect(player_id, room.id, websocket)
                    await manager.broadcast_to_room(room.id, {
                        "type": "ROOM_STATE",
                        "room": room.model_dump(mode="json"),
                    })

                    response = RoomCreatedMessage(
                        type="ROOM_CREATED",
                        request_id=request.request_id,
                        room_id=room.id,
                        player_id=player_id,
                        is_host=True,
                    )
                    await websocket.send_json(response.model_dump(mode="json"))
                    continue

                if message_type == "JOIN_ROOM":
                    request = JoinRoomMessage.model_validate(message)
                    room = await room_service.join_room(request.room_id, player_id)

                    await manager.connect(player_id, room.id, websocket)
                    await manager.broadcast_to_room(room.id, {
                        "type": "ROOM_STATE",
                        "room": room.model_dump(mode="json"),
                    })

                    response = RoomJoinedMessage(
                        type="ROOM_JOINED",
                        request_id=request.request_id,
                        room_id=room.id,
                        player_id=player_id,
                        is_host=room.host_id == player_id,
                    )
                    await websocket.send_json(response.model_dump(mode="json"))
                    continue

                if message_type == "START_GAME":
                    request = StartGameMessage.model_validate(message)
                    room_id = manager.player_rooms.get(player_id)
                    if room_id is None:
                        raise ValueError("PLAYER_NOT_IN_ROOM")

                    room = await room_service.start_room(room_id, player_id)
                    room.game_id = room.id
                    await room_service.room_repository.save_room(room)

                    await manager.broadcast_to_room(room.id, {
                        "type": "GAME_STARTED",
                        "room_id": room.id,
                        "game_id": room.game_id,
                    })
                    continue

                await websocket.send_json({
                    "type": "ERROR",
                    "code": "UNKNOWN_MESSAGE",
                    "message": "Unsupported message type.",
                })

            except ValueError as error:
                await websocket.send_json({
                    "type": "ERROR",
                    "request_id": message.get("request_id"),
                    "code": str(error),
                    "message": str(error),
                })

    except WebSocketDisconnect:
        await manager.disconnect(player_id)
        logger.info("Player disconnected: %s", player_id)
    except Exception:
        await manager.disconnect(player_id)
        logger.exception("WebSocket error for player=%s", player_id)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
