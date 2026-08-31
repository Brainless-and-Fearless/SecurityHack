from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models import DefenceLevel, GameState, Room, Task


class CreateRoomMessage(BaseModel):
    type: Literal["CREATE_ROOM"]
    request_id: str
    nickname: str


class RoomPlayerState(BaseModel):
    id: str
    name: str
    is_host: bool = Field(alias="isHost")
    status: str

    model_config = ConfigDict(
        populate_by_name=True,
    )


class MapPreviewNode(BaseModel):
    id: str
    orbit: int
    x: float
    y: float


class MapPreview(BaseModel):
    orbit_count: int = Field(alias="orbitCount")
    nodes: list[MapPreviewNode]
    edges: list[tuple[str, str]]
    spawn_nodes: list[str] = Field(alias="spawnNodes")

    model_config = ConfigDict(
        populate_by_name=True,
    )    


class RoomStateMessage(BaseModel):
    type: Literal["ROOM_STATE"]
    you: RoomPlayerState
    room_code: str = Field(alias="roomCode")
    players: list[RoomPlayerState]

    model_config = ConfigDict(
        populate_by_name=True,
    )

    map_preview: MapPreview | None = Field(
        default=None,
        alias="mapPreview",
    )    
    
    @field_validator("room_code")
    @classmethod
    def validate_room_code(cls, value: str) -> str:
        if len(value) != 6:
            raise ValueError("ROOM_CODE_MUST_BE_6_CHARACTERS")

        allowed_characters = set(
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        )

        if any(
            character not in allowed_characters
            for character in value
        ):
            raise ValueError("INVALID_ROOM_CODE")

        return value

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


class CancelAttackMessage(BaseModel):
    type: Literal["CANCEL_ATTACK"]
    request_id: str
    task_id: str


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
    theory: str | None = None
    explanation: str | None = None


class AttackCancelledMessage(BaseModel):
    type: Literal["ATTACK_CANCELLED"]
    request_id: str
    task_id: str
    node_id: str


class NodeUpgradedMessage(BaseModel):
    type: Literal["NODE_UPGRADED"]
    request_id: str
    node_id: str
    from_level: DefenceLevel
    to_level: DefenceLevel
    cost: float


class GameFinishedMessage(BaseModel):
    type: Literal["GAME_FINISHED"]
    game_id: str
    winner_id: str | None = None
    scores: dict[str, int]


