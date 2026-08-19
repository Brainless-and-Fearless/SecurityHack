from typing import Literal
from pydantic import BaseModel
from models import Room


class CreateRoomMessage(BaseModel):
    type: Literal["CREATE_ROOM"]
    request_id: str
    nickname: str


class JoinRoomMessage(BaseModel):
    type: Literal["JOIN_ROOM"]
    request_id: str
    room_id: str
    nickname: str


class StartGameMessage(BaseModel):
    type: Literal["START_GAME"]
    request_id: str


class RoomCreatedMessage(BaseModel):
    type: Literal["ROOM_CREATED"]
    request_id: str
    room_id: str
    player_id: str
    is_host: bool


class RoomJoinedMessage(BaseModel):
    type: Literal["ROOM_JOINED"]
    request_id: str
    room_id: str
    player_id: str
    is_host: bool


class RoomStateMessage(BaseModel):
    type: Literal["ROOM_STATE"]
    room: Room
