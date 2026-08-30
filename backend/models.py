from enum import Enum
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import secrets


STARTING_RESOURCES = 20.0


class DefenceLevel(str, Enum):
    K1 = "K1"
    K2 = "K2"
    K3 = "K3"


class GameStatus(str, Enum):
    WAITING = "waiting"
    RUNNING = "running"
    FINISHED = "finished"


class RoomStatus(str, Enum):
    LOBBY = "lobby"
    RUNNING = "running"
    FINISHED = "finished"


class Player(BaseModel):

    id: str
    nickname: str

    score: int = 0

    resources: float = Field(
        default=STARTING_RESOURCES,
        ge=0,
        le=200,
    )

    owned_node_ids: list[str] = Field(default_factory=list)


class Room(BaseModel):
    id: str

    host_id: str

    status: RoomStatus = RoomStatus.LOBBY

    player_ids: list[str] = Field(default_factory=list)

    player_nicknames: dict[str, str] = Field(
        default_factory=dict
    )
    
    max_players: int = Field(
        default=8,
        ge=2,
        le=8,
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )

    map_preview_seed: int = Field(
        default_factory=lambda: secrets.randbelow(2**31),
    )

    game_id: Optional[str] = None


class Node(BaseModel):
    id: str

    x: float = 0.0
    y: float = 0.0

    owner_id: Optional[str] = None

    defence_level: DefenceLevel = DefenceLevel.K1

    neighbor_ids: list[str] = Field(
        default_factory=list
    )

    active_attack_player_id: Optional[str] = None


class Task(BaseModel):
    id: str
    node_id: str
    player_id: str
    defence_level: DefenceLevel
    template_id: str | None = None
    question: str


class TaskTemplate(BaseModel):
    id: str
    difficulty: DefenceLevel
    category: str
    question: str
    answer: str
    explanation: str
    theory: str


class TaskResolution(BaseModel):
    success: bool
    score_change: int = 0
    theory: str | None = None
    explanation: str | None = None


class GameState(BaseModel):
    status: GameStatus = GameStatus.WAITING

    players: dict[str, Player] = Field(default_factory=dict)
    nodes: dict[str, Node] = Field(default_factory=dict)
    tasks: dict[str, Task] = Field(default_factory=dict)

    remaining_time_seconds: int = 15 * 60