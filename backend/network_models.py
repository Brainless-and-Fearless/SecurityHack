from typing import Literal

from pydantic import BaseModel

from models import GameState, Room, Task


class CreateRoomMessage(BaseModel):
    type: Literal["CREATE_ROOM"]
    request_id: str
    nickname: str


class RoomStateMessage(BaseModel):
    type: Literal["ROOM_STATE"]
    room: Room


class RoomCreatedMessage(BaseModel):
    type: Literal["ROOM_CREATED"]
    request_id: str
    room_id: str
    player_id: str
    is_host: bool


class ErrorMessage(BaseModel):
    type: Literal["ERROR"]
    request_id: str | None = None
    code: str
    message: str


class JoinRoomMessage(BaseModel):
    type: Literal["JOIN_ROOM"]
    request_id: str
    room_id: str
    nickname: str


class StartGameMessage(BaseModel):
    type: Literal["START_GAME"]
    request_id: str


class AttackNodeMessage(BaseModel):
    type: Literal["ATTACK_NODE"]
    request_id: str
    node_id: str


class AnswerTaskMessage(BaseModel):
    type: Literal["ANSWER_TASK"]
    request_id: str
    task_id: str
    answer: str


class UpgradeNodeMessage(BaseModel):
    type: Literal["UPGRADE_NODE"]
    request_id: str
    node_id: str


class RoomJoinedMessage(BaseModel):
    type: Literal["ROOM_JOINED"]
    request_id: str
    room_id: str
    player_id: str
    is_host: bool


class GameStartedMessage(BaseModel):
    type: Literal["GAME_STARTED"]
    room_id: str
    game_id: str


class GameStateMessage(BaseModel):
    type: Literal["GAME_STATE"]
    game_id: str
    game: GameState


class AttackStartedMessage(BaseModel):
    type: Literal["ATTACK_STARTED"]
    request_id: str
    node_id: str
    task: Task


class AttackResolvedMessage(BaseModel):
    type: Literal["ATTACK_RESOLVED"]
    request_id: str
    node_id: str
    success: bool
    score_change: int


class GameFinishedMessage(BaseModel):
    type: Literal["GAME_FINISHED"]
    game_id: str
    winner_id: str | None = None
    scores: dict[str, int]