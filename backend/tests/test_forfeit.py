from game_logic import forfeit_player
from models import (
    DefenceLevel,
    GameState,
    GameStatus,
    Node,
    Player,
    Task,
)


def make_running_game(player_count: int) -> GameState:
    players = {}
    nodes = {}

    for index in range(player_count):
        player_id = f"player_{index + 1}"
        node_id = f"node_{index + 1}"
        players[player_id] = Player(
            id=player_id,
            nickname=f"Player {index + 1}",
            owned_node_ids=[node_id],
            spawn_node_id=node_id,
        )
        nodes[node_id] = Node(
            id=node_id,
            owner_id=player_id,
        )

    return GameState(
        status=GameStatus.RUNNING,
        players=players,
        nodes=nodes,
    )


def test_two_player_forfeit_finishes_with_remaining_player_as_winner():
    game = make_running_game(2)

    removed_task_ids = forfeit_player(game, "player_1")

    assert removed_task_ids == []
    assert game.status == GameStatus.FINISHED
    assert game.winner_id == "player_2"
    assert game.is_draw is False
    assert list(game.players) == ["player_2"]
    assert game.nodes["node_1"].owner_id is None


def test_three_player_forfeit_keeps_two_player_match_running():
    game = make_running_game(3)

    forfeit_player(game, "player_1")

    assert game.status == GameStatus.RUNNING
    assert game.winner_id is None
    assert set(game.players) == {"player_2", "player_3"}


def test_repeated_forfeits_finish_only_when_one_player_remains():
    game = make_running_game(5)

    for player_id in ["player_1", "player_2", "player_3"]:
        forfeit_player(game, player_id)
        assert game.status == GameStatus.RUNNING

    forfeit_player(game, "player_4")

    assert game.status == GameStatus.FINISHED
    assert game.winner_id == "player_5"
    assert list(game.players) == ["player_5"]


def test_forfeit_cleans_active_task_reservation_and_all_owned_nodes():
    game = make_running_game(3)
    game.nodes["captured"] = Node(
        id="captured",
        owner_id="player_1",
        active_attack_player_id="player_1",
    )
    game.players["player_1"].owned_node_ids.append("captured")
    game.tasks["task_1"] = Task(
        id="task_1",
        node_id="node_2",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
        question="Question",
    )
    game.nodes["node_2"].active_attack_player_id = "player_1"

    removed_task_ids = forfeit_player(game, "player_1")

    assert removed_task_ids == ["task_1"]
    assert "task_1" not in game.tasks
    assert game.nodes["node_2"].active_attack_player_id is None
    assert game.nodes["node_1"].owner_id is None
    assert game.nodes["captured"].owner_id is None
    assert game.nodes["captured"].active_attack_player_id is None
    assert all(
        node.owner_id != "player_1"
        and node.active_attack_player_id != "player_1"
        for node in game.nodes.values()
    )
