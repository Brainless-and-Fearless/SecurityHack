from map_generator import MapSpec
from models import DefenceLevel, Node


def map_spec_to_nodes(map_spec: MapSpec) -> list[Node]:
    nodes_by_id = {
        map_node.id: Node(
            id=map_node.id,
            x=map_node.x,
            y=map_node.y,
            owner_id=None,
            defence_level=DefenceLevel.K1,
            neighbor_ids=[],
            active_attack_player_id=None,
        )
        for map_node in map_spec.nodes
    }

    for source_id, target_id in map_spec.edges:
        nodes_by_id[source_id].neighbor_ids.append(target_id)
        nodes_by_id[target_id].neighbor_ids.append(source_id)

    return list(nodes_by_id.values())