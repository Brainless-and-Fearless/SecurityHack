from enum import Enum
from typing import Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field


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
        default=5.0,
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

    game_id: Optional[str] = None


class Node(BaseModel):
    id: str

    owner_id: Optional[str] = None

    defence_level: DefenceLevel = DefenceLevel.K1

    neighbor_ids: list[str] = Field(default_factory=list)

    active_attack_player_id: Optional[str] = None


class Task(BaseModel):
    id: str

    node_id: str
    player_id: str

    defence_level: DefenceLevel

    question: str


class GameState(BaseModel):
    status: GameStatus = GameStatus.WAITING

    players: dict[str, Player] = Field(default_factory=dict)
    nodes: dict[str, Node] = Field(default_factory=dict)
    tasks: dict[str, Task] = Field(default_factory=dict)

    remaining_time_seconds: int = 15 * 60