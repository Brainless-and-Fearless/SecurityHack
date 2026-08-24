import pytest

from models import DefenceLevel, GameStatus, Node, Player
from game_logic import (
    MAX_RESOURCES,
    RESOURCE_INCOME_PER_NODE,
    create_game,
    add_player,
    start_game,
    start_attack,
    resolve_attack,
    upgrade_node,
    tick_game,
)


def create_test_game():
    """
    Create a small graph for testing:

        A --- B --- C

    A, B and C are connected in a line.
    """

    nodes = [
        Node(
            id="A",
            neighbor_ids=["B"],
        ),
        Node(
            id="B",
            neighbor_ids=["A", "C"],
        ),
        Node(
            id="C",
            neighbor_ids=["B"],
        ),
    ]

    return create_game(nodes)


def create_two_player_attack_test_game():
    """
    Create a graph where two players can attack
    the same neutral node.
    """

    nodes = [
        Node(
            id="A",
            neighbor_ids=["C"],
        ),
        Node(
            id="B",
            neighbor_ids=["C"],
        ),
        Node(
            id="C",
            neighbor_ids=["A", "B"],
        ),
    ]

    return create_game(nodes)


def prepare_two_player_game():
    """
    Create and start a game with two players.
    """

    game = create_test_game()

    add_player(game, "player_1", "Alice")
    add_player(game, "player_2", "Bob")

    start_game(game)

    return game


# ---------------------------------------------------------------------------
# Game creation
# ---------------------------------------------------------------------------

def test_game_starts_in_waiting_state():
    game = create_test_game()

    assert game.status == GameStatus.WAITING
    assert game.remaining_time_seconds == 900


def test_player_receives_starting_node():
    game = create_test_game()

    player = add_player(
        game,
        "player_1",
        "Alice",
    )

    assert len(player.owned_node_ids) == 1

    node_id = player.owned_node_ids[0]

    assert game.nodes[node_id].owner_id == "player_1"
    assert game.nodes[node_id].defence_level == DefenceLevel.K1


# ---------------------------------------------------------------------------
# Attack validation
# ---------------------------------------------------------------------------

def test_player_can_attack_neighbor():
    game = prepare_two_player_game()

    player_1 = game.players["player_1"]

    player_1_node = next(
        node
        for node in game.nodes.values()
        if node.owner_id == player_1.id
    )

    neighbor_node = player_1_node.neighbor_ids[0]

    task = start_attack(
        game,
        "player_1",
        neighbor_node,
        "task_1",
        "2 + 2 = ?",
    )

    assert task.node_id == neighbor_node
    assert task.player_id == "player_1"


def test_player_cannot_attack_own_node():
    game = prepare_two_player_game()

    player_1 = game.players["player_1"]

    own_node_id = player_1.owned_node_ids[0]

    try:
        start_attack(
            game,
            "player_1",
            own_node_id,
            "task_1",
            "Question",
        )

        assert False, "Expected attack to fail"

    except ValueError as error:
        assert str(error) == "OWN_NODE"


def test_player_cannot_attack_non_neighbor():
    game = prepare_two_player_game()

    # Player 1 starts at A.
    # C is not adjacent to A.
    try:
        start_attack(
            game,
            "player_1",
            "C",
            "task_1",
            "Question",
        )

        assert False, "Expected attack to fail"

    except ValueError as error:
        assert str(error) == "NODE_NOT_NEIGHBOR"


def test_node_cannot_have_two_simultaneous_attacks():
    game = create_two_player_attack_test_game()

    add_player(game, "player_1", "Alice")
    add_player(game, "player_2", "Bob")

    start_game(game)

    start_attack(
        game,
        "player_1",
        "C",
        "task_1",
        "Question",
    )

    try:
        start_attack(
            game,
            "player_2",
            "C",
            "task_2",
            "Question",
        )
    except ValueError as error:
        assert str(error) == "NODE_BUSY"
    else:
        assert False, "Second attack should have been rejected"


# ---------------------------------------------------------------------------
# Successful capture
# ---------------------------------------------------------------------------

def test_successful_k1_capture_gives_5_points():
    game = prepare_two_player_game()

    # Player 1 attacks B.
    start_attack(
        game,
        "player_1",
        "B",
        "task_1",
        "Question",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        "task_1",
        True,
    )

    assert score_change == 5
    assert game.players["player_1"].score == 5

    assert game.nodes["B"].owner_id == "player_1"
    assert game.nodes["B"].defence_level == DefenceLevel.K1


def test_successful_k2_capture_gives_10_points_and_resets_defence():
    game = prepare_two_player_game()

    # Give player 2 ownership of B.
    game.nodes["B"].owner_id = "player_2"

    game.nodes["B"].defence_level = DefenceLevel.K2

    start_attack(
        game,
        "player_1",
        "B",
        "task_1",
        "Question",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        "task_1",
        True,
    )

    assert score_change == 10
    assert game.players["player_1"].score == 10

    assert game.nodes["B"].owner_id == "player_1"
    assert game.nodes["B"].defence_level == DefenceLevel.K1

    assert "B" not in game.players["player_2"].owned_node_ids
    assert "B" in game.players["player_1"].owned_node_ids


def test_successful_k3_capture_gives_15_points():
    game = prepare_two_player_game()

    game.nodes["B"].owner_id = "player_2"
    game.players["player_2"].owned_node_ids.append("B")

    game.nodes["B"].defence_level = DefenceLevel.K3

    start_attack(
        game,
        "player_1",
        "B",
        "task_1",
        "Question",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        "task_1",
        True,
    )

    assert score_change == 15
    assert game.players["player_1"].score == 15

    assert game.nodes["B"].owner_id == "player_1"
    assert game.nodes["B"].defence_level == DefenceLevel.K1


# ---------------------------------------------------------------------------
# Failed capture
# ---------------------------------------------------------------------------

def test_failed_k1_attack_removes_3_points():
    game = prepare_two_player_game()

    start_attack(
        game,
        "player_1",
        "B",
        "task_1",
        "Question",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        "task_1",
        False,
    )

    assert score_change == -3
    assert game.players["player_1"].score == -3

    assert game.nodes["B"].owner_id == "player_2"
    assert game.nodes["B"].defence_level == DefenceLevel.K1


def test_failed_k3_attack_removes_9_points_without_changing_owner():
    game = prepare_two_player_game()

    game.nodes["B"].defence_level = DefenceLevel.K3

    start_attack(
        game,
        "player_1",
        "B",
        "task_1",
        "Question",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        "task_1",
        False,
    )

    assert score_change == -9
    assert game.players["player_1"].score == -9

    assert game.nodes["B"].owner_id == "player_2"
    assert game.nodes["B"].defence_level == DefenceLevel.K3


# ---------------------------------------------------------------------------
# Defence upgrades
# ---------------------------------------------------------------------------

def test_player_can_upgrade_node_from_k1_to_k2():
    game = prepare_two_player_game()

    player = game.players["player_1"]

    player.resources = 100.0
    starting_resources = player.resources

    node_id = player.owned_node_ids[0]

    new_level = upgrade_node(
        game,
        "player_1",
        node_id,
    )

    assert new_level == DefenceLevel.K2
    assert game.nodes[node_id].defence_level == DefenceLevel.K2

    assert player.resources == starting_resources - 10


def test_player_can_upgrade_node_from_k2_to_k3():
    game = prepare_two_player_game()

    player = game.players["player_1"]
    player.resources = 100.0

    node_id = player.owned_node_ids[0]

    upgrade_node(
        game,
        "player_1",
        node_id,
    )

    upgrade_node(
        game,
        "player_1",
        node_id,
    )

    assert game.nodes[node_id].defence_level == DefenceLevel.K3

    assert player.resources == 70


def test_player_cannot_upgrade_k3():
    game = prepare_two_player_game()

    player = game.players["player_1"]
    player.resources = 100.0

    node_id = player.owned_node_ids[0]

    upgrade_node(game, "player_1", node_id)
    upgrade_node(game, "player_1", node_id)

    try:
        upgrade_node(game, "player_1", node_id)

        assert False, "Expected upgrade to fail"

    except ValueError as error:
        assert str(error) == "MAX_DEFENCE_REACHED"


def test_player_cannot_upgrade_node_without_resources():
    game = prepare_two_player_game()

    player = game.players["player_1"]
    node_id = player.owned_node_ids[0]

    player.resources = 0

    try:
        upgrade_node(
            game,
            "player_1",
            node_id,
        )

        assert False, "Expected upgrade to fail"

    except ValueError as error:
        assert str(error) == "INSUFFICIENT_RESOURCES"


# ---------------------------------------------------------------------------
# Economy
# ---------------------------------------------------------------------------

def test_player_receives_resource_income_each_second():
    game = prepare_two_player_game()

    player = game.players["player_1"]
    starting_resources = player.resources

    tick_game(game)

    assert player.resources == starting_resources + RESOURCE_INCOME_PER_NODE


def test_resource_income_is_received_for_each_owned_node():
    game = prepare_two_player_game()

    player = game.players["player_1"]

    # Give player 1 another node.
    game.nodes["C"].owner_id = "player_1"
    player.owned_node_ids.append("C")

    starting_resources = player.resources

    tick_game(game)

    assert player.resources == (
        starting_resources + RESOURCE_INCOME_PER_NODE * 2
    )


def test_resources_cannot_exceed_200():
    game = prepare_two_player_game()

    player = game.players["player_1"]
    player.resources = MAX_RESOURCES

    tick_game(game)

    assert player.resources == MAX_RESOURCES


# ---------------------------------------------------------------------------
# Timer
# ---------------------------------------------------------------------------

def test_game_timer_decreases_each_second():
    game = prepare_two_player_game()

    assert game.remaining_time_seconds == 900

    tick_game(game)

    assert game.remaining_time_seconds == 899


def test_game_finishes_after_15_minutes():
    game = prepare_two_player_game()

    for _ in range(900):
        tick_game(game)

    assert game.remaining_time_seconds == 0
    assert game.status == GameStatus.FINISHED


def test_game_winner_is_player_with_highest_score():
    game = prepare_two_player_game()

    game.players["player_1"].score = 100
    game.players["player_2"].score = 50

    for _ in range(900):
        tick_game(game)

    assert game.status == GameStatus.FINISHED


def test_game_can_end_in_a_draw():
    game = prepare_two_player_game()

    game.players["player_1"].score = 100
    game.players["player_2"].score = 100

    for _ in range(900):
        tick_game(game)

    assert game.status == GameStatus.FINISHED


def test_add_player_can_use_explicit_start_node():
    game = create_game(
        [
            Node(id="A"),
            Node(id="B"),
        ]
    )

    player = add_player(
        game,
        player_id="player_1",
        nickname="Alice",
        start_node_id="B",
    )

    assert player.owned_node_ids == ["B"]
    assert game.nodes["B"].owner_id == "player_1"
    assert game.nodes["A"].owner_id is None    


def test_add_player_rejects_occupied_start_node():
    game = create_game(
        [
            Node(
                id="A",
                owner_id="player_1",
            ),
            Node(id="B"),
        ]
    )

    with pytest.raises(
        ValueError,
        match="START_NODE_UNAVAILABLE",
    ):
        add_player(
            game,
            player_id="player_2",
            nickname="Bob",
            start_node_id="A",
        )    


def test_add_player_rejects_unknown_start_node():
    game = create_game(
        [
            Node(id="A"),
            Node(id="B"),
        ]
    )

    with pytest.raises(
        ValueError,
        match="START_NODE_NOT_FOUND",
    ):
        add_player(
            game,
            player_id="player_1",
            nickname="Alice",
            start_node_id="Z",
        )        

def test_player_default_resources_are_20():
    player = Player(
        id="player_1",
        nickname="Alice",
    )

    assert player.resources == 20.0        