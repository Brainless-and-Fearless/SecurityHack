from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DefenceLevel(str, Enum):
    K1 = "K1"
    K2 = "K2"
    K3 = "K3"


class GameStatus(str, Enum):
    WAITING = "waiting"
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