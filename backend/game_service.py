import secrets

from game_logic import (
    add_player,
    create_game,
    start_game,
)
from map_conversion import map_spec_to_nodes
from map_generator import generate_map
from models import GameState, Room
from redis_repository import GameStateRepository


class GameService:
    def __init__(
        self,
        game_repository: GameStateRepository,
    ):
        self.game_repository = game_repository

    async def start_game(
        self,
        room: Room,
    ) -> tuple[str, GameState]:

        if len(room.player_ids) < 2:
            raise ValueError("NOT_ENOUGH_PLAYERS")
        
        player_count = len(room.player_ids)

        map_spec = generate_map(
            player_count,
        )

        nodes = map_spec_to_nodes(
            map_spec,
        )

        game = create_game(nodes)

        for player_id, spawn_node_id in zip(
            room.player_ids,
            map_spec.spawn_nodes,
        ):
            nickname = room.player_nicknames.get(
                player_id,
            )

            if nickname is None:
                raise ValueError(
                    "PLAYER_NICKNAME_NOT_FOUND"
                )

            add_player(
                game,
                player_id,
                nickname,
                start_node_id=spawn_node_id,
            )

        start_game(game)

        game_id = secrets.token_hex(8)

        await self.game_repository.save_game(
            game_id,
            game,
        )

        return game_id, game