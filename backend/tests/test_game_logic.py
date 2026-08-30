import pytest
import game_logic

from task_manager import TaskManager
from models import (
    DefenceLevel,
    GameStatus,
    Node,
    Player,
    Task,
    TaskResolution,
    TaskTemplate,
)
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


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

def create_test_task_manager():
    return TaskManager(
        [
            TaskTemplate(
                id="test_k1",
                difficulty=DefenceLevel.K1,
                category="TEST",
                question="Question K1",
                answer="answer",
                explanation="Explanation K1",
                theory="Theory K1",
            ),
            TaskTemplate(
                id="test_k2",
                difficulty=DefenceLevel.K2,
                category="TEST",
                question="Question K2",
                answer="answer",
                explanation="Explanation K2",
                theory="Theory K2",
            ),
            TaskTemplate(
                id="test_k3",
                difficulty=DefenceLevel.K3,
                category="TEST",
                question="Question K3",
                answer="answer",
                explanation="Explanation K3",
                theory="Theory K3",
            ),
        ]
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


def create_player_with_two_attack_targets_game():
    """Create a running game with two valid targets for player_1."""

    nodes = [
        Node(id="A", neighbor_ids=["B", "C", "D"]),
        Node(id="B", neighbor_ids=["A"]),
        Node(id="C", neighbor_ids=["A"]),
        Node(id="D", neighbor_ids=["A"]),
    ]

    game = create_game(nodes)

    add_player(
        game,
        "player_1",
        "Alice",
        start_node_id="A",
    )
    add_player(
        game,
        "player_2",
        "Bob",
        start_node_id="D",
    )

    start_game(game)

    return game


def prepare_two_player_game():
    """
    Create and start a game with two players.
    """

    game = create_test_game()

    add_player(game, "player_1", "Alice")
    add_player(game, "player_2", "Bob")

    start_game(game)

    return game


def start_test_attack(
    game,
    player_id,
    node_id,
    task_manager=None,
):
    """
    Start an attack using the current TaskManager-based contract.
    """

    if task_manager is None:
        task_manager = create_test_task_manager()

    return start_attack(
        game,
        player_id,
        node_id,
        task_manager=task_manager,
    )


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

    task = start_test_attack(
        game,
        "player_1",
        neighbor_node,
    )

    assert task.node_id == neighbor_node
    assert task.player_id == "player_1"
    assert task.defence_level == game.nodes[neighbor_node].defence_level
    assert task.template_id == "test_k1"
    assert task.question == "Question K1"

    assert game.nodes[neighbor_node].active_attack_player_id == "player_1"
    assert task.id in game.tasks


def test_player_cannot_attack_own_node():
    game = prepare_two_player_game()

    player_1 = game.players["player_1"]

    own_node_id = player_1.owned_node_ids[0]

    with pytest.raises(
        ValueError,
        match="OWN_NODE",
    ):
        start_test_attack(
            game,
            "player_1",
            own_node_id,
        )


def test_player_cannot_attack_non_neighbor():
    game = prepare_two_player_game()

    # Player 1 starts at A.
    # C is not adjacent to A.

    with pytest.raises(
        ValueError,
        match="NODE_NOT_NEIGHBOR",
    ):
        start_test_attack(
            game,
            "player_1",
            "C",
        )


def test_node_cannot_have_two_simultaneous_attacks():
    game = create_two_player_attack_test_game()

    add_player(game, "player_1", "Alice")
    add_player(game, "player_2", "Bob")

    start_game(game)

    start_test_attack(
        game,
        "player_1",
        "C",
    )

    with pytest.raises(
        ValueError,
        match="NODE_BUSY",
    ):
        start_test_attack(
            game,
            "player_2",
            "C",
        )


def test_player_cannot_start_second_simultaneous_attack():
    game = create_player_with_two_attack_targets_game()
    task_manager = create_test_task_manager()

    start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    with pytest.raises(
        ValueError,
        match="PLAYER_ALREADY_ATTACKING",
    ):
        start_test_attack(
            game,
            "player_1",
            "C",
            task_manager,
        )


# ---------------------------------------------------------------------------
# Successful capture
# ---------------------------------------------------------------------------

def test_successful_k1_capture_gives_5_points():
    game = prepare_two_player_game()

    task_manager = create_test_task_manager()

    task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    resolution = TaskResolution(
        success=True,
        explanation="Explanation",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        task.id,
        resolution,
        task_manager,
    )

    assert score_change == 5
    assert game.players["player_1"].score == 5

    assert game.nodes["B"].owner_id == "player_1"
    assert game.nodes["B"].defence_level == DefenceLevel.K1

    assert game.nodes["B"].active_attack_player_id is None
    assert game.tasks == {}


def test_successful_k2_capture_gives_10_points_and_resets_defence():
    game = prepare_two_player_game()


    game.nodes["B"].defence_level = DefenceLevel.K2

    task_manager = create_test_task_manager()

    task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    assert task.defence_level == DefenceLevel.K2
    assert task.template_id == "test_k2"

    resolution = TaskResolution(
        success=True,
        explanation="Explanation",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        task.id,
        resolution,
        task_manager,
    )

    assert score_change == 10
    assert game.players["player_1"].score == 10

    assert game.nodes["B"].owner_id == "player_1"
    assert game.nodes["B"].defence_level == DefenceLevel.K1

    assert "B" not in game.players["player_2"].owned_node_ids
    assert "B" in game.players["player_1"].owned_node_ids

    assert game.nodes["B"].active_attack_player_id is None
    assert game.tasks == {}


def test_successful_k3_capture_gives_15_points():
    game = prepare_two_player_game()

    game.nodes["B"].owner_id = "player_2"
    game.players["player_2"].owned_node_ids.append("B")

    game.nodes["B"].defence_level = DefenceLevel.K3

    task_manager = create_test_task_manager()

    task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    assert task.defence_level == DefenceLevel.K3
    assert task.template_id == "test_k3"

    resolution = TaskResolution(
        success=True,
        explanation="Explanation",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        task.id,
        resolution,
        task_manager,
    )

    assert score_change == 15
    assert game.players["player_1"].score == 15

    assert game.nodes["B"].owner_id == "player_1"
    assert game.nodes["B"].defence_level == DefenceLevel.K1

    assert game.nodes["B"].active_attack_player_id is None
    assert game.tasks == {}


# ---------------------------------------------------------------------------
# Failed capture
# ---------------------------------------------------------------------------

def test_failed_k1_attack_removes_3_points():
    game = prepare_two_player_game()

    task_manager = create_test_task_manager()

    task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    resolution = TaskResolution(
        success=False,
        theory="Theory",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        task.id,
        resolution,
        task_manager,
    )

    assert score_change == -3
    assert game.players["player_1"].score == -3

    assert game.nodes["B"].owner_id == "player_2"
    assert game.nodes["B"].defence_level == DefenceLevel.K1

    assert game.nodes["B"].active_attack_player_id is None
    assert game.tasks == {}

    retry_task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    assert retry_task.id in game.tasks
    assert (
        game.nodes["B"].active_attack_player_id
        == "player_1"
    )


# ---------------------------------------------------------------------------
# Attack cancellation
# ---------------------------------------------------------------------------

def test_cancel_attack_rejects_unknown_task():
    game = create_player_with_two_attack_targets_game()
    task_manager = create_test_task_manager()

    with pytest.raises(
        ValueError,
        match="TASK_NOT_FOUND",
    ):
        game_logic.cancel_attack(
            game,
            "player_1",
            "missing_task",
            task_manager,
        )


def test_cancel_attack_rejects_task_owned_by_another_player():
    game = create_player_with_two_attack_targets_game()
    task_manager = create_test_task_manager()

    task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    with pytest.raises(
        ValueError,
        match="TASK_NOT_OWNED",
    ):
        game_logic.cancel_attack(
            game,
            "player_2",
            task.id,
            task_manager,
        )

    assert task.id in game.tasks
    assert task.id in task_manager.tasks
    assert (
        game.nodes["B"].active_attack_player_id
        == "player_1"
    )


def test_cancel_attack_releases_node_and_removes_task_without_rewards():
    game = create_player_with_two_attack_targets_game()
    task_manager = create_test_task_manager()

    player = game.players["player_1"]
    player.score = 17

    task = start_test_attack(
        game,
        player.id,
        "B",
        task_manager,
    )

    original_owner_id = game.nodes["B"].owner_id
    original_score = player.score

    game_logic.cancel_attack(
        game,
        player.id,
        task.id,
        task_manager,
    )

    assert game.nodes["B"].active_attack_player_id is None
    assert task.id not in game.tasks
    assert task.id not in task_manager.tasks
    assert game.nodes["B"].owner_id == original_owner_id
    assert player.score == original_score


def test_failed_k3_attack_removes_9_points_without_changing_owner():
    game = prepare_two_player_game()

    game.nodes["B"].defence_level = DefenceLevel.K3

    task_manager = create_test_task_manager()

    task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    assert task.defence_level == DefenceLevel.K3
    assert task.template_id == "test_k3"

    resolution = TaskResolution(
        success=False,
        theory="Theory",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        task.id,
        resolution,
        task_manager,
    )

    assert score_change == -9
    assert game.players["player_1"].score == -9

    assert game.nodes["B"].owner_id == "player_2"
    assert game.nodes["B"].defence_level == DefenceLevel.K3

    assert game.nodes["B"].active_attack_player_id is None
    assert game.tasks == {}


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

    with pytest.raises(
        ValueError,
        match="MAX_DEFENCE_REACHED",
    ):
        upgrade_node(
            game,
            "player_1",
            node_id,
        )


def test_player_cannot_upgrade_node_without_resources():
    game = prepare_two_player_game()

    player = game.players["player_1"]
    node_id = player.owned_node_ids[0]

    player.resources = 0

    with pytest.raises(
        ValueError,
        match="INSUFFICIENT_RESOURCES",
    ):
        upgrade_node(
            game,
            "player_1",
            node_id,
        )


# ---------------------------------------------------------------------------
# Economy
# ---------------------------------------------------------------------------

def test_player_receives_resource_income_each_second():
    game = prepare_two_player_game()

    player = game.players["player_1"]
    starting_resources = player.resources

    tick_game(game)

    assert (
        player.resources
        == starting_resources + RESOURCE_INCOME_PER_NODE
    )


def test_resource_income_is_received_for_each_owned_node():
    game = prepare_two_player_game()

    player = game.players["player_1"]

    # Give player 1 another node.
    game.nodes["C"].owner_id = "player_1"
    player.owned_node_ids.append("C")

    starting_resources = player.resources

    tick_game(game)

    assert (
        player.resources
        == starting_resources
        + RESOURCE_INCOME_PER_NODE * 2
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


# ---------------------------------------------------------------------------
# Explicit starting nodes
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# TaskManager integration
# ---------------------------------------------------------------------------

def test_start_attack_uses_injected_task_manager():
    game = prepare_two_player_game()

    created_task = Task(
        id="task_1",
        node_id="B",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
        template_id="encryption_k1_001",
        question="Question",
    )

    class FakeTaskManager:
        def __init__(self):
            self.calls = []

        def create_task(
            self,
            node_id,
            player_id,
            defence_level,
        ):
            self.calls.append(
                (
                    node_id,
                    player_id,
                    defence_level,
                )
            )
            return created_task

    task_manager = FakeTaskManager()

    task = start_attack(
        game,
        "player_1",
        "B",
        task_manager=task_manager,
    )

    assert task is created_task

    assert task_manager.calls == [
        (
            "B",
            "player_1",
            DefenceLevel.K1,
        )
    ]


def test_resolve_attack_uses_success_from_task_resolution():
    game = prepare_two_player_game()

    task_manager = create_test_task_manager()

    task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    resolution = TaskResolution(
        success=True,
        explanation="Explanation",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        task.id,
        resolution,
        task_manager,
    )

    assert score_change == 5
    assert game.players["player_1"].score == 5
    assert game.nodes["B"].owner_id == "player_1"    


def test_resolve_attack_uses_failure_from_task_resolution():
    game = prepare_two_player_game()

    task_manager = create_test_task_manager()

    task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    resolution = TaskResolution(
        success=False,
        theory="Theory",
    )

    score_change = resolve_attack(
        game,
        "player_1",
        task.id,
        resolution,
        task_manager,
    )

    assert score_change == -3
    assert game.players["player_1"].score == -3
    assert game.nodes["B"].owner_id == "player_2"    


def test_resolve_attack_removes_task_from_task_manager():
    game = prepare_two_player_game()
    task_manager = create_test_task_manager()

    task = start_test_attack(
        game,
        "player_1",
        "B",
        task_manager,
    )

    resolution = TaskResolution(
        success=True,
        explanation="Explanation",
    )

    resolve_attack(
        game,
        "player_1",
        task.id,
        resolution,
        task_manager=task_manager,
    )

    assert task.id not in game.tasks

    with pytest.raises(
        ValueError,
        match="TASK_NOT_FOUND",
    ):
        task_manager.get_task(task.id)
