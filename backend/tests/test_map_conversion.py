import pytest

from map_conversion import map_spec_to_nodes
from map_generator import generate_map
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