import pytest

from math import atan2, pi, hypot
from collections import defaultdict, deque
from map_generator import (
    LARGE_ORBIT_COUNT,
    LARGE_PLAYER_RANGE,
    LARGE_NODE_COUNT,
    MEDIUM_ORBIT_COUNT,
    MEDIUM_PLAYER_RANGE,
    MEDIUM_NODE_COUNT,
    SMALL_ORBIT_COUNT,
    SMALL_PLAYER_RANGE,
    SMALL_NODE_COUNT,
    ORBIT_RADII,
    ANGULAR_JITTER,
    RADIAL_JITTER,
    generate_map,
)


@pytest.mark.parametrize(
    "player_count, expected_orbits, expected_nodes",
    [
        (2, SMALL_ORBIT_COUNT, SMALL_NODE_COUNT),
        (3, SMALL_ORBIT_COUNT, SMALL_NODE_COUNT),
        (4, MEDIUM_ORBIT_COUNT, MEDIUM_NODE_COUNT),
        (6, MEDIUM_ORBIT_COUNT, MEDIUM_NODE_COUNT),
        (7, LARGE_ORBIT_COUNT, LARGE_NODE_COUNT),
        (8, LARGE_ORBIT_COUNT, LARGE_NODE_COUNT),
    ],
)
def test_map_size_depends_on_player_count(
    player_count,
    expected_orbits,
    expected_nodes,
):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    assert map_spec.orbit_count == expected_orbits
    assert len(map_spec.nodes) == expected_nodes


@pytest.mark.parametrize(
    "player_count, expected_spawns",
    [
        (2, 2),
        (3, 3),
        (4, 4),
        (6, 6),
        (7, 7),
        (8, 8),
    ],
)
def test_number_of_spawn_nodes_matches_player_count(
    player_count,
    expected_spawns,
):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    assert len(map_spec.spawn_nodes) == expected_spawns

    assert set(map_spec.spawn_nodes).issubset(
        {
            node.id
            for node in map_spec.nodes
        }
    )


def test_graph_has_no_self_loops():
    map_spec = generate_map(
        4,
        seed=123,
    )

    for source, target in map_spec.edges:
        assert source != target


def test_graph_has_no_duplicate_edges():
    map_spec = generate_map(
        4,
        seed=123,
    )

    normalized_edges = {
        tuple(sorted((source, target)))
        for source, target in map_spec.edges
    }

    assert len(normalized_edges) == len(
        map_spec.edges
    )


def test_same_seed_produces_same_map():
    first_map = generate_map(
        6,
        seed=123,
    )

    second_map = generate_map(
        6,
        seed=123,
    )

    assert first_map == second_map


@pytest.mark.parametrize(
    "player_count",
    [0, 1, 9, 10],
)
def test_player_count_must_be_between_2_and_8(
    player_count,
):
    with pytest.raises(
        ValueError,
        match="INVALID_PLAYER_COUNT",
    ):
        generate_map(
            player_count,
            seed=123,
        )    


@pytest.mark.parametrize(
    "player_count",
    [2, 3, 4, 6, 7, 8],
)
def test_generated_graph_is_connected(player_count):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    graph = defaultdict(set)

    for source, target in map_spec.edges:
        graph[source].add(target)
        graph[target].add(source)

    start_node = map_spec.nodes[0].id

    visited = set()
    queue = deque([start_node])

    while queue:
        current = queue.popleft()

        if current in visited:
            continue

        visited.add(current)

        for neighbor in graph[current]:
            if neighbor not in visited:
                queue.append(neighbor)

    assert len(visited) == len(map_spec.nodes)        


@pytest.mark.parametrize(
    "player_count",
    [2, 3, 4, 6, 7, 8],
)
def test_spawn_nodes_are_on_outer_orbit(player_count):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    outer_orbit = map_spec.orbit_count

    nodes_by_id = {
        node.id: node
        for node in map_spec.nodes
    }

    for spawn_node_id in map_spec.spawn_nodes:
        assert nodes_by_id[spawn_node_id].orbit == outer_orbit    


@pytest.mark.parametrize(
    "player_count",
    [2, 3, 4, 6, 7, 8],
)
def test_spawn_nodes_are_unique(player_count):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    assert len(set(map_spec.spawn_nodes)) == player_count        


@pytest.mark.parametrize(
    "player_count",
    [2, 3, 4, 6, 7, 8],
)
def test_spawn_nodes_are_as_evenly_distributed_as_possible(
    player_count,
):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    outer_nodes = [
        node
        for node in map_spec.nodes
        if node.orbit == map_spec.orbit_count
    ]

    outer_node_count = len(outer_nodes)

    outer_index_by_id = {
        node.id: index
        for index, node in enumerate(outer_nodes)
    }

    spawn_indices = sorted(
        outer_index_by_id[node_id]
        for node_id in map_spec.spawn_nodes
    )

    gaps = [
        spawn_indices[index + 1]
        - spawn_indices[index]
        for index in range(
            len(spawn_indices) - 1
        )
    ]

    gaps.append(
        outer_node_count
        - spawn_indices[-1]
        + spawn_indices[0]
    )

    minimum_gap = outer_node_count // player_count
    maximum_gap = (
        minimum_gap
        if outer_node_count % player_count == 0
        else minimum_gap + 1
    )

    assert all(
        minimum_gap <= gap <= maximum_gap
        for gap in gaps
    )


@pytest.mark.parametrize(
    "player_count",
    [2, 4, 7],
)
def test_nodes_are_on_their_declared_orbits(
    player_count,
):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    for node in map_spec.nodes:
        distance_from_center = hypot(
            node.x,
            node.y,
        )

        expected_radius = ORBIT_RADII[
            node.orbit - 1
        ]

        assert (
            expected_radius - RADIAL_JITTER
            <= distance_from_center
            <= expected_radius + RADIAL_JITTER
        )


def test_orbit_radii_strictly_increase():
    assert all(
        first < second
        for first, second in zip(
            ORBIT_RADII,
            ORBIT_RADII[1:],
        )
    )


@pytest.mark.parametrize(
    "player_count",
    [2, 4, 7],
)
def test_map_uses_origin_as_center(
    player_count,
):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    for node in map_spec.nodes:
        assert -1.0 <= node.x <= 1.0
        assert -1.0 <= node.y <= 1.0            



@pytest.mark.parametrize(
    "player_count",
    [2, 4, 7],
)
def test_nodes_stay_within_their_orbit_jitter(
    player_count,
):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    for node in map_spec.nodes:
        distance_from_center = hypot(
            node.x,
            node.y,
        )

        expected_radius = ORBIT_RADII[
            node.orbit - 1
        ]

        assert (
            expected_radius - RADIAL_JITTER
            <= distance_from_center
            <= expected_radius + RADIAL_JITTER
        )        


def test_same_structure_can_have_different_jitter():
    first_map = generate_map(
        6,
        seed=123,
    )

    second_map = generate_map(
        6,
        seed=456,
    )

    assert first_map != second_map

    assert (
        first_map.orbit_count
        == second_map.orbit_count
    )

    assert len(first_map.nodes) == len(
        second_map.nodes
    )

    assert len(first_map.edges) == len(
        second_map.edges
    )

    assert len(first_map.spawn_nodes) == len(
        second_map.spawn_nodes
    )        


    