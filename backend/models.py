from enum import Enum
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class RoomStatus(str, Enum):
    LOBBY = "lobby"
    RUNNING = "running"
    FINISHED = "finished"


class Room(BaseModel):
    id: str
    host_id: str
    status: RoomStatus = RoomStatus.LOBBY
    player_ids: list[str] = Field(default_factory=list)
    max_players: int = Field(default=8, ge=2, le=8)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    game_id: str | None = None
