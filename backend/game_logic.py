from typing import Optional

from models import (
    DefenceLevel,
    GameState,
    GameStatus,
    Node,
    Player,
    Task,
    TaskResolution,
    STARTING_RESOURCES,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MATCH_DURATION_SECONDS = 15 * 60

MAX_RESOURCES = 200.0

RESOURCE_INCOME_PER_NODE = 0.5

K1_TO_K2_COST = 10.0
K2_TO_K3_COST = 20.0

SUCCESS_SCORE_MULTIPLIER = 5
FAILURE_SCORE_MULTIPLIER = 3


# ---------------------------------------------------------------------------
# Match lifecycle
# ---------------------------------------------------------------------------

def create_game(nodes: list[Node]) -> GameState:
    """
    Create a new game in the WAITING state.

    Nodes are supplied by the caller so that the game logic
    does not depend on a particular map-generation algorithm.
    """

    game = GameState(
        status=GameStatus.WAITING,
        remaining_time_seconds=MATCH_DURATION_SECONDS,
    )

    for node in nodes:
        game.nodes[node.id] = node

    return game


def add_player(
    game: GameState,
    player_id: str,
    nickname: str,
    start_node_id: Optional[str] = None,
) -> Player:
    """
    Add a player to the game and assign a free starting node.
    """

    if game.status != GameStatus.WAITING:
        raise ValueError("Cannot add player after the game has started.")

    if player_id in game.players:
        raise ValueError("Player with this id already exists.")

    start_node = assign_start_node(
        game,
        start_node_id,
    )

    if start_node is None:
        raise ValueError("No free starting node is available.")

    player = Player(
        id=player_id,
        nickname=nickname,
        resources=STARTING_RESOURCES,
        owned_node_ids=[start_node.id],
    )

    start_node.owner_id = player.id
    start_node.defence_level = DefenceLevel.K1

    game.players[player.id] = player

    return player


def assign_start_node(
    game: GameState,
    start_node_id: Optional[str] = None,
) -> Optional[Node]:
    """
    Find a suitable free starting node.

    If start_node_id is provided, use that exact node.
    Otherwise, fall back to the first free node.
    """

    if start_node_id is not None:
        node = game.nodes.get(start_node_id)

        if node is None:
            raise ValueError("START_NODE_NOT_FOUND")

        if node.owner_id is not None:
            raise ValueError("START_NODE_UNAVAILABLE")

        return node

    for node in game.nodes.values():
        if node.owner_id is None:
            return node

    return None


def start_game(game: GameState) -> None:
    """
    Start the match.
    """

    if game.status != GameStatus.WAITING:
        raise ValueError("Game cannot be started from its current state.")

    if len(game.players) < 2:
        raise ValueError("At least two player is required to start the game.")

    game.status = GameStatus.RUNNING
    game.remaining_time_seconds = MATCH_DURATION_SECONDS


def finish_game(game: GameState) -> Optional[str]:
    """
    Finish the match and return the winner's player id.

    Returns None when the game ends in a draw.
    """

    if game.status != GameStatus.RUNNING:
        raise ValueError("Only a running game can be finished.")

    game.status = GameStatus.FINISHED

    if not game.players:
        return None

    highest_score = max(
        player.score
        for player in game.players.values()
    )

    leaders = [
        player
        for player in game.players.values()
        if player.score == highest_score
    ]

    if len(leaders) != 1:
        return None

    return leaders[0].id


# ---------------------------------------------------------------------------
# Attack
# ---------------------------------------------------------------------------

def can_attack(
    game: GameState,
    player_id: str,
    node_id: str,
) -> tuple[bool, Optional[str]]:
    """
    Validate whether a player can attack a node.

    Returns:
        (True, None)
        or
        (False, reason)
    """

    if game.status != GameStatus.RUNNING:
        return False, "GAME_NOT_RUNNING"

    player = game.players.get(player_id)

    if player is None:
        return False, "PLAYER_NOT_FOUND"

    node = game.nodes.get(node_id)

    if node is None:
        return False, "NODE_NOT_FOUND"

    if node.owner_id == player_id:
        return False, "OWN_NODE"

    if not _owned_neighbors(game, player_id, node_id):
        return False, "NODE_NOT_NEIGHBOR"

    if node.active_attack_player_id is not None:
        return False, "NODE_BUSY"

    return True, None


def start_attack(
    game: GameState,
    player_id: str,
    node_id: str,
    task_manager,
) -> Task:
    """
    Start an attack and create a task.

    The node is locked for the attacking player until
    the task is resolved.
    """

    can_attack_result, reason = can_attack(
        game,
        player_id,
        node_id,
    )

    if not can_attack_result:
        raise ValueError(reason)

    node = game.nodes[node_id]

    task = task_manager.create_task(
        node_id=node.id,
        player_id=player_id,
        defence_level=node.defence_level,
    )

    game.tasks[task.id] = task
    node.active_attack_player_id = player_id

    return task


def resolve_attack(
    game: GameState,
    player_id: str,
    task_id: str,
    resolution: TaskResolution,
    task_manager,
) -> int:
    """
    Resolve an active attack.

    Returns the score change applied to the attacker.
    """

    task = game.tasks.get(task_id)

    if task is None:
        raise ValueError("TASK_NOT_FOUND")

    if task.player_id != player_id:
        raise ValueError("TASK_NOT_OWNED")

    player = game.players.get(task.player_id)

    if player is None:
        raise ValueError("PLAYER_NOT_FOUND")

    node = game.nodes.get(task.node_id)

    if node is None:
        raise ValueError("NODE_NOT_FOUND")

    defence_value = defence_level_value(task.defence_level)

    if resolution.success:
        score_change = SUCCESS_SCORE_MULTIPLIER * defence_value

        previous_owner_id = node.owner_id

        if previous_owner_id is not None:
            previous_owner = game.players.get(previous_owner_id)

            if previous_owner is not None:
                if node.id in previous_owner.owned_node_ids:
                    previous_owner.owned_node_ids.remove(node.id)

        node.owner_id = player.id

        if node.id not in player.owned_node_ids:
            player.owned_node_ids.append(node.id)

        node.defence_level = DefenceLevel.K1

    else:
        score_change = -FAILURE_SCORE_MULTIPLIER * defence_value

    player.score += score_change

    node.active_attack_player_id = None
    del game.tasks[task_id]

    task_manager.remove_task(task.id)

    return score_change


# ---------------------------------------------------------------------------
# Defence / economy
# ---------------------------------------------------------------------------

def upgrade_node(
    game: GameState,
    player_id: str,
    node_id: str,
) -> DefenceLevel:
    """
    Upgrade a node's defence level.

    Returns the new defence level.
    """

    if game.status != GameStatus.RUNNING:
        raise ValueError("GAME_NOT_RUNNING")

    player = game.players.get(player_id)

    if player is None:
        raise ValueError("PLAYER_NOT_FOUND")

    node = game.nodes.get(node_id)

    if node is None:
        raise ValueError("NODE_NOT_FOUND")

    if node.owner_id != player_id:
        raise ValueError("NOT_NODE_OWNER")

    if node.defence_level == DefenceLevel.K3:
        raise ValueError("MAX_DEFENCE_REACHED")

    cost = get_upgrade_cost(node.defence_level)

    if player.resources < cost:
        raise ValueError("INSUFFICIENT_RESOURCES")

    player.resources -= cost

    if node.defence_level == DefenceLevel.K1:
        node.defence_level = DefenceLevel.K2

    elif node.defence_level == DefenceLevel.K2:
        node.defence_level = DefenceLevel.K3

    return node.defence_level


def tick_resources(game: GameState) -> None:
    """
    Apply one second of resource income.
    """

    if game.status != GameStatus.RUNNING:
        return

    for node in game.nodes.values():
        if node.owner_id is None:
            continue

        player = game.players.get(node.owner_id)

        if player is None:
            continue

        player.resources = min(
            player.resources + RESOURCE_INCOME_PER_NODE,
            MAX_RESOURCES,
        )


def tick_game(game: GameState) -> Optional[str]:
    """
    Advance the game by one second.

    Returns the winner's id when the game ends.
    Returns None otherwise or in case of a draw.
    """

    if game.status != GameStatus.RUNNING:
        return None

    tick_resources(game)

    game.remaining_time_seconds -= 1

    if game.remaining_time_seconds <= 0:
        game.remaining_time_seconds = 0
        return finish_game(game)

    return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def defence_level_value(level: DefenceLevel) -> int:
    """
    Convert K1/K2/K3 into their numeric values.
    """

    values = {
        DefenceLevel.K1: 1,
        DefenceLevel.K2: 2,
        DefenceLevel.K3: 3,
    }

    return values[level]


def get_upgrade_cost(level: DefenceLevel) -> float:
    """
    Return the resource cost for upgrading from the given level.
    """

    costs = {
        DefenceLevel.K1: K1_TO_K2_COST,
        DefenceLevel.K2: K2_TO_K3_COST,
    }

    if level not in costs:
        raise ValueError("MAX_DEFENCE_REACHED")

    return costs[level]


def _owned_neighbors(
    game: GameState,
    player_id: str,
    target_node_id: str,
) -> list[str]:
    """
    Return the ids of the player's nodes adjacent to the target node.
    """

    target_node = game.nodes[target_node_id]

    return [
        node_id
        for node_id in target_node.neighbor_ids
        if (
            node_id in game.nodes
            and game.nodes[node_id].owner_id == player_id
        )
    ]


def calculate_attack_score(
    defence_level: DefenceLevel,
    success: bool,
) -> int:
    """
    Calculate score change for an attack without modifying game state.
    """

    k = defence_level_value(defence_level)

    if success:
        return SUCCESS_SCORE_MULTIPLIER * k

    return -FAILURE_SCORE_MULTIPLIER * k