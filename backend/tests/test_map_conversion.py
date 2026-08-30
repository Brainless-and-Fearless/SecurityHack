import pytest

from map_conversion import map_spec_to_nodes
from map_generator import MapNode, MapSpec, generate_map
from models import DefenceLevel


@pytest.mark.parametrize(
    "player_count",
    [2, 4, 7],
)
def test_map_spec_converts_to_game_nodes(
    player_count,
):
    map_spec = generate_map(
        player_count,
        seed=123,
    )

    nodes = map_spec_to_nodes(map_spec)

    assert len(nodes) == len(map_spec.nodes)

    assert {
        node.id for node in nodes
    } == {
        map_node.id
        for map_node in map_spec.nodes
    }


def test_converted_nodes_start_neutral():
    map_spec = generate_map(
        4,
        seed=123,
    )

    nodes = map_spec_to_nodes(map_spec)

    for node in nodes:
        assert node.owner_id is None
        assert node.defence_level == DefenceLevel.K1
        assert node.active_attack_player_id is None


def test_converted_nodes_preserve_graph_edges():
    map_spec = generate_map(
        6,
        seed=123,
    )

    nodes = map_spec_to_nodes(map_spec)

    neighbors = {
        node.id: set(node.neighbor_ids)
        for node in nodes
    }

    for source, target in map_spec.edges:
        assert target in neighbors[source]
        assert source in neighbors[target]

def test_map_spec_to_nodes_preserves_node_coordinates():
    map_spec = MapSpec(
        orbit_count=1,
        nodes=(
            MapNode(
                id="n1_0",
                orbit=1,
                x=0.25,
                y=-0.4,
            ),
            MapNode(
                id="n1_1",
                orbit=1,
                x=-0.7,
                y=0.15,
            ),
        ),
        edges=(
            ("n1_0", "n1_1"),
        ),
        spawn_nodes=(
            "n1_0",
        ),
    )

    nodes = map_spec_to_nodes(map_spec)

    nodes_by_id = {
        node.id: node
        for node in nodes
    }

    assert nodes_by_id["n1_0"].x == 0.25
    assert nodes_by_id["n1_0"].y == -0.4

    assert nodes_by_id["n1_1"].x == -0.7
    assert nodes_by_id["n1_1"].y == 0.15        