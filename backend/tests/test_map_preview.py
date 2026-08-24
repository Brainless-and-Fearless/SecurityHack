from map_generator import MapNode, MapSpec
from map_preview import map_spec_to_preview
from models import Room
from map_preview import build_room_map_preview

def test_map_spec_to_preview_preserves_map_geometry():
    map_spec = MapSpec(
        orbit_count=3,
        nodes=(
            MapNode(
                id="n1_0",
                orbit=1,
                x=0.2,
                y=0.1,
            ),
            MapNode(
                id="n3_0",
                orbit=3,
                x=0.7,
                y=-0.2,
            ),
        ),
        edges=(
            ("n1_0", "n3_0"),
        ),
        spawn_nodes=(
            "n3_0",
        ),
    )

    preview = map_spec_to_preview(
        map_spec,
    )

    assert preview.orbit_count == 3

    assert len(preview.nodes) == 2
    assert preview.nodes[0].id == "n1_0"
    assert preview.nodes[0].orbit == 1
    assert preview.nodes[0].x == 0.2
    assert preview.nodes[0].y == 0.1

    assert preview.edges == [
        ("n1_0", "n3_0"),
    ]

    assert preview.spawn_nodes == [
        "n3_0",
    ]

from map_generator import generate_map
from map_preview import map_spec_to_preview


def test_room_seed_produces_stable_map_preview():
    seed = 123456
    player_count = 2

    first_map = generate_map(
        player_count,
        seed=seed,
    )

    second_map = generate_map(
        player_count,
        seed=seed,
    )

    first_preview = map_spec_to_preview(
        first_map,
    )

    second_preview = map_spec_to_preview(
        second_map,
    )

    assert first_preview == second_preview    


def test_room_map_preview_uses_room_seed():
    room = Room(
        id="ABC234",
        host_id="player_1",
        player_ids=[
            "player_1",
            "player_2",
        ],
        player_nicknames={
            "player_1": "Alice",
            "player_2": "Bob",
        },
        map_preview_seed=123456,
    )

    preview = build_room_map_preview(room)

    expected_map = generate_map(
        player_count=2,
        seed=123456,
    )

    expected_preview = map_spec_to_preview(
        expected_map,
    )

    assert preview == expected_preview    


    