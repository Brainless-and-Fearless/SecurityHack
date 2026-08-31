import secrets
from dataclasses import dataclass


@dataclass(frozen=True)
class ResumeSession:
    token: str
    player_id: str
    room_id: str


class SessionRegistry:
    """Process-local resume credentials for the current backend runtime."""

    def __init__(self):
        self.sessions: dict[str, ResumeSession] = {}

    def create(
        self,
        player_id: str,
        room_id: str,
    ) -> ResumeSession:
        while True:
            token = secrets.token_urlsafe(32)

            if token not in self.sessions:
                break

        session = ResumeSession(
            token=token,
            player_id=player_id,
            room_id=room_id,
        )
        self.sessions[token] = session

        return session

    def get(self, token: str) -> ResumeSession | None:
        return self.sessions.get(token)

    def invalidate(self, token: str) -> None:
        self.sessions.pop(token, None)

    def invalidate_for_player(
        self,
        room_id: str,
        player_id: str,
    ) -> None:
        tokens = [
            token
            for token, session in self.sessions.items()
            if (
                session.room_id == room_id
                and session.player_id == player_id
            )
        ]

        for token in tokens:
            self.invalidate(token)
