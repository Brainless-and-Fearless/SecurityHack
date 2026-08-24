from map_generator import MapSpec, generate_map
from network_models import MapPreview, MapPreviewNode
from models import Room

def map_spec_to_preview(
    map_spec: MapSpec,
) -> MapPreview:
    nodes = [
        MapPreviewNode(
            id=node.id,
            orbit=node.orbit,
            x=node.x,
            y=node.y,
        )
        for node in map_spec.nodes
    ]

    return MapPreview(
        orbit_count=map_spec.orbit_count,
        nodes=nodes,
        edges=list(map_spec.edges),
        spawn_nodes=list(map_spec.spawn_nodes),
    )

def build_room_map_preview(
    room: Room,
) -> MapPreview:
    player_count = max(
        2,
        len(room.player_ids),
    )

    map_spec = generate_map(
        player_count,
        seed=room.map_preview_seed,
    )

    return map_spec_to_preview(
        map_spec,
    )