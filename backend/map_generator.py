from dataclasses import dataclass
from math import cos, pi, sin
import random


SMALL_PLAYER_RANGE = range(2, 4)
MEDIUM_PLAYER_RANGE = range(4, 7)
LARGE_PLAYER_RANGE = range(7, 9)

SMALL_ORBIT_COUNT = 3
MEDIUM_ORBIT_COUNT = 4
LARGE_ORBIT_COUNT = 5

SMALL_NODE_COUNT = 18
MEDIUM_NODE_COUNT = 28
LARGE_NODE_COUNT = 40

SMALL_NODES_PER_ORBIT = (4, 6, 8)
MEDIUM_NODES_PER_ORBIT = (4, 6, 8, 10)
LARGE_NODES_PER_ORBIT = (4, 6, 8, 10, 12)

RADIAL_JITTER = 0.025
ANGULAR_JITTER = 0.08

ORBIT_RADII = (
    0.22,
    0.40,
    0.58,
    0.76,
    0.94,
)


@dataclass(frozen=True)
class MapNode:
    id: str
    orbit: int
    x: float
    y: float


@dataclass(frozen=True)
class MapSpec:
    orbit_count: int
    nodes: tuple[MapNode, ...]
    edges: tuple[tuple[str, str], ...]
    spawn_nodes: tuple[str, ...]


def _get_map_config(
    player_count: int,
) -> tuple[int, tuple[int, ...]]:
    if player_count in SMALL_PLAYER_RANGE:
        return (
            SMALL_ORBIT_COUNT,
            SMALL_NODES_PER_ORBIT,
        )

    if player_count in MEDIUM_PLAYER_RANGE:
        return (
            MEDIUM_ORBIT_COUNT,
            MEDIUM_NODES_PER_ORBIT,
        )

    if player_count in LARGE_PLAYER_RANGE:
        return (
            LARGE_ORBIT_COUNT,
            LARGE_NODES_PER_ORBIT,
        )

    raise ValueError("INVALID_PLAYER_COUNT")


def generate_map(
    player_count: int,
    *,
    seed: int | None = None,
) -> MapSpec:
    orbit_count, nodes_per_orbit = _get_map_config(
        player_count,
    )

    rng = random.Random(seed)

    nodes: list[MapNode] = []
    edges: set[tuple[str, str]] = set()

    orbit_nodes: list[list[MapNode]] = []

    global_rotation = rng.uniform(
        0.0,
        2 * pi,
    )

    for orbit_index, node_count in enumerate(
        nodes_per_orbit,
        start=1,
    ):
        base_radius = ORBIT_RADII[orbit_index - 1]
        current_orbit: list[MapNode] = []

        for node_index in range(node_count):
            base_angle = (
                2
                * pi
                * node_index
                / node_count
            )

            radial_offset = rng.uniform(
                -RADIAL_JITTER,
                RADIAL_JITTER,
            )

            angular_offset = rng.uniform(
                -ANGULAR_JITTER,
                ANGULAR_JITTER,
            )

            radius = base_radius + radial_offset

            angle = (
                base_angle
                + global_rotation
                + angular_offset
            )

            node = MapNode(
                id=f"n{orbit_index}_{node_index}",
                orbit=orbit_index,
                x=radius * cos(angle),
                y=radius * sin(angle),
            )

            nodes.append(node)
            current_orbit.append(node)

        orbit_nodes.append(current_orbit)

    def add_edge(
        first_id: str,
        second_id: str,
    ) -> None:
        if first_id == second_id:
            return

        edge = tuple(
            sorted(
                (first_id, second_id)
            )
        )

        edges.add(edge)

    # Ring edges.
    for current_orbit in orbit_nodes:
        for index, node in enumerate(current_orbit):
            next_node = current_orbit[
                (index + 1) % len(current_orbit)
            ]

            add_edge(
                node.id,
                next_node.id,
            )

    # Radial edges between neighboring orbits.
    for orbit_index in range(
        len(orbit_nodes) - 1
    ):
        inner_orbit = orbit_nodes[orbit_index]
        outer_orbit = orbit_nodes[orbit_index + 1]

        for index, node in enumerate(inner_orbit):
            target_index = round(
                index
                * len(outer_orbit)
                / len(inner_orbit)
            ) % len(outer_orbit)

            add_edge(
                node.id,
                outer_orbit[target_index].id,
            )

    # Spawn nodes are evenly distributed on the outer orbit.
    outer_orbit = orbit_nodes[-1]

    spawn_nodes: list[str] = []

    for player_index in range(player_count):
        spawn_index = round(
            player_index
            * len(outer_orbit)
            / player_count
        ) % len(outer_orbit)

        spawn_node_id = outer_orbit[
            spawn_index
        ].id

        spawn_nodes.append(
            spawn_node_id
        )

    return MapSpec(
        orbit_count=orbit_count,
        nodes=tuple(nodes),
        edges=tuple(sorted(edges)),
        spawn_nodes=tuple(spawn_nodes),
    )