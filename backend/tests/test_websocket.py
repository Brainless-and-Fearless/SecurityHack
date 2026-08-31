from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from network_models import RoomStateMessage
from main import app
from task_manager import TaskManager
from models import DefenceLevel, GameStatus, TaskTemplate


async def set_game_remaining_time(game_id, remaining_time_seconds):
    game = await app.state.game_repository.get_game(game_id)
    game.remaining_time_seconds = remaining_time_seconds
    await app.state.game_repository.save_game(game_id, game)


async def get_test_game(game_id):
    return await app.state.game_repository.get_game(game_id)


async def update_resume_test_state(game_id, player_id):
    game = await app.state.game_repository.get_game(game_id)
    game.remaining_time_seconds = 321
    game.players[player_id].resources = 77
    await app.state.game_repository.save_game(game_id, game)


def run_final_tick(client, room_id, game_id):
    client.portal.call(
        set_game_remaining_time,
        game_id,
        1,
    )
    return client.portal.call(
        app.state.game_loop_manager._tick_once,
        room_id,
        game_id,
    )

def create_test_websocket_task_manager():
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


def start_two_player_websocket_attack(
    host_ws,
    player_ws,
    consume_game_state=True,
):
    host_ws.send_json(
        {
            "type": "CREATE_ROOM",
            "request_id": "req_create_for_cancel",
            "nickname": "Alice",
        }
    )

    host_ws.receive_json()  # ROOM_STATE
    host_created = host_ws.receive_json()

    player_ws.send_json(
        {
            "type": "JOIN_ROOM",
            "request_id": "req_join_for_cancel",
            "room_id": host_created["room_id"],
            "nickname": "Bob",
        }
    )

    player_ws.receive_json()  # ROOM_STATE
    player_joined = player_ws.receive_json()
    host_ws.receive_json()  # updated ROOM_STATE

    host_ws.send_json(
        {
            "type": "START_GAME",
            "request_id": "req_start_for_cancel",
        }
    )

    host_ws.receive_json()  # GAME_STARTED
    host_game_state = host_ws.receive_json()
    player_ws.receive_json()  # GAME_STARTED
    player_ws.receive_json()  # GAME_STATE

    game = host_game_state["game"]
    host_player_id = host_created["player_id"]
    owned_node_id = game["players"][
        host_player_id
    ]["owned_node_ids"][0]

    target_node_id = next(
        node_id
        for node_id in game["nodes"][
            owned_node_id
        ]["neighbor_ids"]
        if game["nodes"][node_id]["owner_id"]
        != host_player_id
    )

    host_ws.send_json(
        {
            "type": "ATTACK_NODE",
            "request_id": "req_attack_for_cancel",
            "node_id": target_node_id,
        }
    )

    attack_started = host_ws.receive_json()

    assert attack_started["type"] == "ATTACK_STARTED"

    if consume_game_state:
        host_game_state = host_ws.receive_json()
        player_game_state = player_ws.receive_json()

        assert host_game_state["type"] == "GAME_STATE"
        assert player_game_state["type"] == "GAME_STATE"

    return {
        "room_id": host_created["room_id"],
        "game_id": host_game_state["game_id"],
        "task": attack_started["task"],
        "target_node_id": target_node_id,
        "host_player_id": host_player_id,
        "player_id": player_joined["player_id"],
        "host_session_token": host_created["session_token"],
        "player_session_token": player_joined["session_token"],
    }


def start_two_player_websocket_game(host_ws, player_ws):
    host_ws.send_json(
        {
            "type": "CREATE_ROOM",
            "request_id": "req_upgrade_create",
            "nickname": "Alice",
        }
    )

    host_ws.receive_json()  # ROOM_STATE
    host_created = host_ws.receive_json()

    player_ws.send_json(
        {
            "type": "JOIN_ROOM",
            "request_id": "req_upgrade_join",
            "room_id": host_created["room_id"],
            "nickname": "Bob",
        }
    )

    player_ws.receive_json()  # ROOM_STATE
    player_joined = player_ws.receive_json()
    host_ws.receive_json()  # updated ROOM_STATE

    host_ws.send_json(
        {
            "type": "START_GAME",
            "request_id": "req_upgrade_start",
        }
    )

    host_ws.receive_json()  # GAME_STARTED
    host_game_state = host_ws.receive_json()
    player_ws.receive_json()  # GAME_STARTED
    player_game_state = player_ws.receive_json()

    assert host_game_state["type"] == "GAME_STATE"
    assert player_game_state["type"] == "GAME_STATE"
    assert host_game_state["game"] == player_game_state["game"]

    return {
        "room_id": host_created["room_id"],
        "game_id": host_game_state["game_id"],
        "game": host_game_state["game"],
        "host_player_id": host_created["player_id"],
        "player_id": player_joined["player_id"],
        "host_session_token": host_created["session_token"],
        "player_session_token": player_joined["session_token"],
    }


def test_create_room_registers_player_connection():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json(
                {
                    "type": "CREATE_ROOM",
                    "request_id": "req_register",
                    "nickname": "Alice",
                }
            )

            response = websocket.receive_json()

            assert response["type"] in {
                "ROOM_STATE",
                "ROOM_CREATED",
            }

            connection_manager = app.state.connection_manager

            assert len(connection_manager.connections) == 1

            player_id = next(
                iter(connection_manager.connections)
            )

            assert (
                connection_manager.connections[player_id]
                is not None
            )


def test_create_room_sends_room_state_and_room_created():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json(
                {
                    "type": "CREATE_ROOM",
                    "request_id": "req_create",
                    "nickname": "Alice",
                }
            )

            first_response = websocket.receive_json()
            second_response = websocket.receive_json()

            assert first_response["type"] == "ROOM_STATE"
            assert second_response["type"] == "ROOM_CREATED"

            room_state = first_response
            room_created = second_response

            assert room_state["roomCode"] == room_created["room_id"]

            assert room_state["you"]["id"] == room_created["player_id"]
            assert room_state["you"]["name"] == "Alice"
            assert room_state["you"]["isHost"] is True

            assert room_created["request_id"] == "req_create"
            assert room_created["is_host"] is True

            assert len(room_state["players"]) == 1
            assert room_state["players"][0]["id"] == room_created["player_id"]
            assert room_state["players"][0]["name"] == "Alice"
            assert room_state["players"][0]["isHost"] is True


def test_second_player_can_join_room():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            host_ws.send_json(
                {
                    "type": "CREATE_ROOM",
                    "request_id": "req_create",
                    "nickname": "Alice",
                }
            )

            host_room_state = host_ws.receive_json()
            host_created = host_ws.receive_json()

            assert host_room_state["type"] == "ROOM_STATE"
            assert host_created["type"] == "ROOM_CREATED"

            room_id = host_created["room_id"]
            host_player_id = host_created["player_id"]

            with client.websocket_connect("/ws") as player_ws:
                player_ws.send_json(
                    {
                        "type": "JOIN_ROOM",
                        "request_id": "req_join",
                        "room_id": room_id,
                        "nickname": "Bob",
                    }
                )

                player_room_state = player_ws.receive_json()

                assert player_room_state["type"] == "ROOM_STATE"
                
                assert player_room_state["mapPreview"] is not None

                player_preview = player_room_state["mapPreview"]

                assert player_preview["orbitCount"] > 0
                assert len(player_preview["nodes"]) > 0
                assert len(player_preview["edges"]) > 0
                assert len(player_preview["spawnNodes"]) > 0
                player_joined = player_ws.receive_json()

                assert player_joined["type"] == "ROOM_JOINED"

                room_state = player_room_state

                assert room_state["roomCode"] == room_id

                assert room_state["you"]["id"] == player_joined["player_id"]
                assert room_state["you"]["name"] == "Bob"
                assert room_state["you"]["isHost"] is False

                assert len(room_state["players"]) == 2

                assert {
                    player["id"]
                    for player in room_state["players"]
                } == {
                    host_player_id,
                    player_joined["player_id"],
                }

                host_state = next(
                    player
                    for player in room_state["players"]
                    if player["id"] == host_player_id
                )

                joined_state = next(
                    player
                    for player in room_state["players"]
                    if player["id"] == player_joined["player_id"]
                )

                assert host_state["name"] == "Alice"
                assert host_state["isHost"] is True

                assert joined_state["name"] == "Bob"
                assert joined_state["isHost"] is False

                assert player_joined["request_id"] == "req_join"
                assert player_joined["room_id"] == room_id
                assert player_joined["is_host"] is False

                host_updated_state = host_ws.receive_json()

                assert host_updated_state["type"] == "ROOM_STATE"
                assert host_updated_state["roomCode"] == room_id

                assert player_room_state["you"]["name"] == "Bob"
                assert player_room_state["you"]["isHost"] is False

                assert host_updated_state["you"]["name"] == "Alice"
                assert host_updated_state["you"]["isHost"] is True

                assert (
                    player_room_state["mapPreview"]
                    == host_updated_state["mapPreview"]
                )

                assert host_updated_state["mapPreview"] is not None

                host_preview = host_updated_state["mapPreview"]

                assert host_preview == player_preview
                assert {
                    player["id"]
                    for player in host_updated_state["players"]
                } == {
                    host_player_id,
                    player_joined["player_id"],
                }

                preview_node = player_preview["nodes"][0]

                assert set(preview_node) == {
                    "id",
                    "orbit",
                    "x",
                    "y",
                }


def test_create_room_returns_valid_room_state_message():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json(
                {
                    "type": "CREATE_ROOM",
                    "request_id": "req_room_state",
                    "nickname": "Alice",
                }
            )

            room_state = websocket.receive_json()

            assert room_state["type"] == "ROOM_STATE"

            validated_message = RoomStateMessage.model_validate(
                room_state
            )

            assert validated_message.room_code
            assert validated_message.you.id
            assert validated_message.you.name == "Alice"
            assert validated_message.you.is_host is True

            assert len(validated_message.players) == 1
            assert validated_message.players[0].name == "Alice"                


def test_host_can_start_game_and_all_players_receive_game_state():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            host_ws.send_json(
                {
                    "type": "CREATE_ROOM",
                    "request_id": "req_create",
                    "nickname": "Alice",
                }
            )

            host_room_state = host_ws.receive_json()
            host_created = host_ws.receive_json()

            assert host_room_state["type"] == "ROOM_STATE"
            assert host_created["type"] == "ROOM_CREATED"

            room_id = host_created["room_id"]

            with client.websocket_connect("/ws") as player_ws:
                player_ws.send_json(
                    {
                        "type": "JOIN_ROOM",
                        "request_id": "req_join",
                        "room_id": room_id,
                        "nickname": "Bob",
                    }
                )

                player_room_state = player_ws.receive_json()
                player_joined = player_ws.receive_json()

                assert player_room_state["type"] == "ROOM_STATE"
                assert player_joined["type"] == "ROOM_JOINED"

                host_updated_state = host_ws.receive_json()

                assert host_updated_state["type"] == "ROOM_STATE"

                host_ws.send_json(
                    {
                        "type": "START_GAME",
                        "request_id": "req_start",
                    }
                )

                host_messages = [
                    host_ws.receive_json(),
                    host_ws.receive_json(),
                ]

                player_messages = [
                    player_ws.receive_json(),
                    player_ws.receive_json(),
                ]

                host_types = {
                    message["type"]
                    for message in host_messages
                }

                player_types = {
                    message["type"]
                    for message in player_messages
                }

                assert host_types == {
                    "GAME_STARTED",
                    "GAME_STATE",
                }

                assert player_types == {
                    "GAME_STARTED",
                    "GAME_STATE",
                }

                host_game_state = next(
                    message
                    for message in host_messages
                    if message["type"] == "GAME_STATE"
                )

                player_game_state = next(
                    message
                    for message in player_messages
                    if message["type"] == "GAME_STATE"
                )

                assert host_game_state == player_game_state

                game = host_game_state["game"]

                assert game["status"] == "running"
                assert game["remaining_time_seconds"] == 900

                assert len(game["players"]) == 2
                assert len(game["nodes"]) > 0

                assert player_joined["player_id"] in game["players"]

                host_player_id = host_created["player_id"]
                player_id = player_joined["player_id"]

                assert host_player_id in game["players"]
                assert player_id in game["players"]

                host_player = game["players"][host_player_id]
                joined_player = game["players"][player_id]

                assert host_player["id"] == host_player_id
                assert host_player["nickname"] == "Alice"
                assert host_player["score"] == 0
                assert host_player["resources"] == 20.0

                assert joined_player["id"] == player_id
                assert joined_player["nickname"] == "Bob"
                assert joined_player["score"] == 0
                assert joined_player["resources"] == 20.0

                assert len(host_player["owned_node_ids"]) == 1
                assert len(joined_player["owned_node_ids"]) == 1

                assert (
                    set(host_player["owned_node_ids"]).isdisjoint(
                        joined_player["owned_node_ids"]
                    )
                )

                assert game["tasks"] == {}

                for node_id, node in game["nodes"].items():
                    assert node["id"] == node_id
                    assert node["defence_level"] == "K1"


def test_start_game_launches_runtime_once_for_created_game():
    with TestClient(app) as client:
        original_manager = getattr(
            app.state,
            "game_loop_manager",
            None,
        )
        runtime = Mock()
        app.state.game_loop_manager = runtime

        try:
            with client.websocket_connect("/ws") as host_ws:
                host_ws.send_json(
                    {
                        "type": "CREATE_ROOM",
                        "request_id": "req_runtime_create",
                        "nickname": "Alice",
                    }
                )
                host_ws.receive_json()
                created = host_ws.receive_json()

                with client.websocket_connect("/ws") as player_ws:
                    player_ws.send_json(
                        {
                            "type": "JOIN_ROOM",
                            "request_id": "req_runtime_join",
                            "room_id": created["room_id"],
                            "nickname": "Bob",
                        }
                    )
                    player_ws.receive_json()
                    player_ws.receive_json()
                    host_ws.receive_json()

                    host_ws.send_json(
                        {
                            "type": "START_GAME",
                            "request_id": "req_runtime_start",
                        }
                    )

                    host_ws.receive_json()
                    host_ws.receive_json()
                    player_ws.receive_json()
                    player_ws.receive_json()

                    runtime.start.assert_called_once()
                    room_id, game_id = (
                        runtime.start.call_args.args
                    )

                    assert room_id == created["room_id"]
                    assert isinstance(game_id, str)
                    assert game_id
        finally:
            if original_manager is None:
                del app.state.game_loop_manager
            else:
                app.state.game_loop_manager = original_manager

                    
def test_player_can_start_attack_over_websocket():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            host_ws.send_json(
                {
                    "type": "CREATE_ROOM",
                    "request_id": "req_create",
                    "nickname": "Alice",
                }
            )

            host_room_state = host_ws.receive_json()
            host_created = host_ws.receive_json()

            room_id = host_created["room_id"]

            with client.websocket_connect("/ws") as player_ws:
                player_ws.send_json(
                    {
                        "type": "JOIN_ROOM",
                        "request_id": "req_join",
                        "room_id": room_id,
                        "nickname": "Bob",
                    }
                )

                player_ws.receive_json()  # ROOM_STATE
                player_ws.receive_json()  # ROOM_JOINED
                host_ws.receive_json()    # updated ROOM_STATE

                host_ws.send_json(
                    {
                        "type": "START_GAME",
                        "request_id": "req_start",
                    }
                )

                host_ws.receive_json()    # GAME_STARTED
                host_game_state = host_ws.receive_json()

                player_ws.receive_json()  # GAME_STARTED
                player_ws.receive_json()  # GAME_STATE

                game = host_game_state["game"]

                host_player_id = host_created["player_id"]
                host_player = game["players"][host_player_id]

                owned_node_id = host_player["owned_node_ids"][0]
                owned_node = game["nodes"][owned_node_id]

                target_node_id = next(
                    node_id
                    for node_id in owned_node["neighbor_ids"]
                    if game["nodes"][node_id]["owner_id"]
                    != host_player_id
                )

                host_ws.send_json(
                    {
                        "type": "ATTACK_NODE",
                        "request_id": "req_attack",
                        "node_id": target_node_id,
                    }
                )

                response = host_ws.receive_json()

                assert response["type"] == "ATTACK_STARTED"
                assert response["request_id"] == "req_attack"
                assert response["node_id"] == target_node_id

                task = response["task"]

                assert task["node_id"] == target_node_id
                assert task["player_id"] == host_player_id
                assert task["question"]
                assert task["defence_level"] == (
                    game["nodes"][target_node_id]["defence_level"]
                )


def test_attack_node_over_websocket_rejects_non_neighbor():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            host_ws.send_json(
                {
                    "type": "CREATE_ROOM",
                    "request_id": "req_create",
                    "nickname": "Alice",
                }
            )

            host_ws.receive_json()
            host_created = host_ws.receive_json()

            room_id = host_created["room_id"]

            with client.websocket_connect("/ws") as player_ws:
                player_ws.send_json(
                    {
                        "type": "JOIN_ROOM",
                        "request_id": "req_join",
                        "room_id": room_id,
                        "nickname": "Bob",
                    }
                )

                player_ws.receive_json()
                player_ws.receive_json()
                host_ws.receive_json()

                host_ws.send_json(
                    {
                        "type": "START_GAME",
                        "request_id": "req_start",
                    }
                )

                host_ws.receive_json()
                host_game_state = host_ws.receive_json()

                player_ws.receive_json()
                player_ws.receive_json()

                game = host_game_state["game"]
                host_player_id = host_created["player_id"]

                owned_node_id = game["players"][
                    host_player_id
                ]["owned_node_ids"][0]

                owned_node = game["nodes"][owned_node_id]

                non_neighbor_node_id = next(
                    node_id
                    for node_id, node in game["nodes"].items()
                    if (
                        node_id != owned_node_id
                        and node_id
                        not in owned_node["neighbor_ids"]
                    )
                )

                host_ws.send_json(
                    {
                        "type": "ATTACK_NODE",
                        "request_id": "req_attack",
                        "node_id": non_neighbor_node_id,
                    }
                )

                response = host_ws.receive_json()

                assert response["type"] == "ERROR"
                assert response["request_id"] == "req_attack"
                assert response["code"] == "NODE_NOT_NEIGHBOR"                

def test_answer_task_over_websocket_resolves_attack():
    with TestClient(app) as client:
        original_task_manager = app.state.task_manager

        app.state.task_manager = (
            create_test_websocket_task_manager()
        )

        try:
            with client.websocket_connect("/ws") as host_ws:
                host_ws.send_json(
                    {
                        "type": "CREATE_ROOM",
                        "request_id": "req_create",
                        "nickname": "Alice",
                    }
                )

                host_ws.receive_json()
                host_created = host_ws.receive_json()

                room_id = host_created["room_id"]
                host_player_id = host_created["player_id"]

                with client.websocket_connect("/ws") as player_ws:
                    player_ws.send_json(
                        {
                            "type": "JOIN_ROOM",
                            "request_id": "req_join",
                            "room_id": room_id,
                            "nickname": "Bob",
                        }
                    )

                    player_ws.receive_json()
                    player_ws.receive_json()
                    host_ws.receive_json()

                    host_ws.send_json(
                        {
                            "type": "START_GAME",
                            "request_id": "req_start",
                        }
                    )

                    host_ws.receive_json()
                    host_game_state = host_ws.receive_json()

                    player_ws.receive_json()
                    player_ws.receive_json()

                    game = host_game_state["game"]

                    owned_node_id = game["players"][
                        host_player_id
                    ]["owned_node_ids"][0]

                    owned_node = game["nodes"][
                        owned_node_id
                    ]

                    target_node_id = next(
                        node_id
                        for node_id in owned_node["neighbor_ids"]
                        if game["nodes"][node_id]["owner_id"]
                        != host_player_id
                    )

                    host_ws.send_json(
                        {
                            "type": "ATTACK_NODE",
                            "request_id": "req_attack",
                            "node_id": target_node_id,
                        }
                    )

                    attack_started = host_ws.receive_json()

                    assert (
                        attack_started["type"]
                        == "ATTACK_STARTED"
                    )

                    assert (
                        attack_started["request_id"]
                        == "req_attack"
                    )

                    assert (
                        attack_started["node_id"]
                        == target_node_id
                    )

                    task = attack_started["task"]

                    assert task["node_id"] == target_node_id
                    assert task["player_id"] == host_player_id
                    assert task["question"] == "Question K1"
                    assert task["template_id"] == "test_k1"

                    attack_game_state = host_ws.receive_json()
                    player_attack_game_state = player_ws.receive_json()

                    assert attack_game_state["type"] == "GAME_STATE"
                    assert (
                        player_attack_game_state["type"]
                        == "GAME_STATE"
                    )

                    host_ws.send_json(
                        {
                            "type": "ANSWER_TASK",
                            "request_id": "req_answer",
                            "task_id": task["id"],
                            "answer": "answer",
                        }
                    )

                    response = host_ws.receive_json()

                    assert (
                        response["type"]
                        == "ATTACK_RESOLVED"
                    )

                    assert (
                        response["request_id"]
                        == "req_answer"
                    )

                    assert (
                        response["node_id"]
                        == target_node_id
                    )

                    assert response["success"] is True
                    assert response["score_change"] == 5
                    assert response["theory"] is None
                    assert (
                        response["explanation"]
                        == "Explanation K1"
                    )

                    game_state = host_ws.receive_json()

                    assert (
                        game_state["type"]
                        == "GAME_STATE"
                    )

                    updated_game = game_state["game"]

                    assert (
                        updated_game["nodes"][
                            target_node_id
                        ]["owner_id"]
                        == host_player_id
                    )

                    assert (
                        updated_game["nodes"][
                            target_node_id
                        ]["defence_level"]
                        == "K1"
                    )

                    assert task["id"] not in updated_game["tasks"]

        finally:
            app.state.task_manager = original_task_manager


def test_attack_start_broadcasts_game_state_to_all_players():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            with client.websocket_connect("/ws") as player_ws:
                attack = start_two_player_websocket_attack(
                    host_ws,
                    player_ws,
                    consume_game_state=False,
                )

                task = attack["task"]
                node_id = attack["target_node_id"]

                # This safe probe produces an ERROR after any messages
                # already queued by the successful attack start.
                host_ws.send_json(
                    {
                        "type": "ATTACK_NODE",
                        "request_id": "req_attack_probe",
                        "node_id": node_id,
                    }
                )

                host_game_state = host_ws.receive_json()

                assert host_game_state["type"] == "GAME_STATE"

                host_probe_error = host_ws.receive_json()

                assert host_probe_error["type"] == "ERROR"
                assert host_probe_error["code"] == (
                    "PLAYER_ALREADY_ATTACKING"
                )

                # Bob must receive the queued GAME_STATE before the
                # response to his own non-mutating ownership probe.
                player_ws.send_json(
                    {
                        "type": "CANCEL_ATTACK",
                        "request_id": "req_cancel_probe",
                        "task_id": task["id"],
                    }
                )

                player_game_state = player_ws.receive_json()

                assert player_game_state["type"] == "GAME_STATE"
                assert (
                    player_game_state["game"]
                    == host_game_state["game"]
                )

                player_probe_error = player_ws.receive_json()

                assert player_probe_error["type"] == "ERROR"
                assert player_probe_error["code"] == "TASK_NOT_OWNED"

                game = host_game_state["game"]

                assert (
                    game["nodes"][node_id][
                        "active_attack_player_id"
                    ]
                    == attack["host_player_id"]
                )
                assert task["id"] in game["tasks"]


def test_cancel_attack_over_websocket_acknowledges_and_broadcasts_state():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            with client.websocket_connect("/ws") as player_ws:
                attack = start_two_player_websocket_attack(
                    host_ws,
                    player_ws,
                )

                task = attack["task"]
                node_id = attack["target_node_id"]

                host_ws.send_json(
                    {
                        "type": "CANCEL_ATTACK",
                        "request_id": "req_cancel",
                        "task_id": task["id"],
                    }
                )

                acknowledgement = host_ws.receive_json()

                assert acknowledgement == {
                    "type": "ATTACK_CANCELLED",
                    "request_id": "req_cancel",
                    "task_id": task["id"],
                    "node_id": node_id,
                }

                host_game_state = host_ws.receive_json()
                player_game_state = player_ws.receive_json()

                assert host_game_state["type"] == "GAME_STATE"
                assert player_game_state["type"] == "GAME_STATE"
                assert (
                    host_game_state["game"]
                    == player_game_state["game"]
                )

                updated_game = host_game_state["game"]

                assert (
                    updated_game["nodes"][node_id][
                        "active_attack_player_id"
                    ]
                    is None
                )
                assert task["id"] not in updated_game["tasks"]


def test_player_cannot_cancel_another_players_attack_over_websocket():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            with client.websocket_connect("/ws") as player_ws:
                attack = start_two_player_websocket_attack(
                    host_ws,
                    player_ws,
                )

                player_ws.send_json(
                    {
                        "type": "CANCEL_ATTACK",
                        "request_id": "req_cancel_not_owned",
                        "task_id": attack["task"]["id"],
                    }
                )

                response = player_ws.receive_json()

                assert response["type"] == "ERROR"
                assert response["request_id"] == (
                    "req_cancel_not_owned"
                )
                assert response["code"] == "TASK_NOT_OWNED"


def test_upgrade_node_acknowledges_and_broadcasts_authoritative_state():
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        original_lock = game_loop_manager.lock
        game_loop_manager.start = Mock()
        game_loop_manager.lock = Mock(wraps=original_lock)

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    started = start_two_player_websocket_game(
                        host_ws,
                        player_ws,
                    )
                    game = started["game"]
                    host_player_id = started["host_player_id"]
                    node_id = game["players"][host_player_id][
                        "owned_node_ids"
                    ][0]
                    starting_resources = game["players"][
                        host_player_id
                    ]["resources"]

                    host_ws.send_json(
                        {
                            "type": "UPGRADE_NODE",
                            "request_id": "req_upgrade",
                            "node_id": node_id,
                        }
                    )

                    acknowledgement = host_ws.receive_json()

                    assert acknowledgement == {
                        "type": "NODE_UPGRADED",
                        "request_id": "req_upgrade",
                        "node_id": node_id,
                        "from_level": "K1",
                        "to_level": "K2",
                        "cost": 10.0,
                    }

                    host_game_state = host_ws.receive_json()
                    player_game_state = player_ws.receive_json()

                    assert host_game_state["type"] == "GAME_STATE"
                    assert player_game_state["type"] == "GAME_STATE"
                    assert (
                        host_game_state["game"]
                        == player_game_state["game"]
                    )

                    updated_game = host_game_state["game"]
                    assert updated_game["nodes"][node_id][
                        "defence_level"
                    ] == "K2"
                    assert updated_game["players"][host_player_id][
                        "resources"
                    ] == starting_resources - 10.0

                    game_loop_manager.lock.assert_any_call(
                        started["game_id"]
                    )
        finally:
            game_loop_manager.start = original_start
            game_loop_manager.lock = original_lock


def test_player_cannot_upgrade_enemy_node_over_websocket():
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        game_loop_manager.start = Mock()

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    started = start_two_player_websocket_game(
                        host_ws,
                        player_ws,
                    )
                    game = started["game"]
                    host_player_id = started["host_player_id"]
                    node_id = game["players"][host_player_id][
                        "owned_node_ids"
                    ][0]

                    for request_id in (
                        "req_enemy_upgrade",
                        "req_enemy_upgrade_probe",
                    ):
                        player_ws.send_json(
                            {
                                "type": "UPGRADE_NODE",
                                "request_id": request_id,
                                "node_id": node_id,
                            }
                        )

                        response = player_ws.receive_json()
                        assert response["type"] == "ERROR"
                        assert response["request_id"] == request_id
                        assert response["code"] == "NOT_NODE_OWNER"

                    host_ws.send_json(
                        {
                            "type": "UPGRADE_NODE",
                            "request_id": "req_owner_upgrade",
                            "node_id": node_id,
                        }
                    )

                    acknowledgement = host_ws.receive_json()
                    assert acknowledgement["type"] == "NODE_UPGRADED"
                    assert acknowledgement["from_level"] == "K1"
                    assert acknowledgement["to_level"] == "K2"

                    host_game_state = host_ws.receive_json()
                    player_game_state = player_ws.receive_json()
                    assert (
                        host_game_state["game"]
                        == player_game_state["game"]
                    )
                    assert host_game_state["game"]["players"][
                        host_player_id
                    ]["resources"] == 10.0
        finally:
            game_loop_manager.start = original_start

def test_upgrade_node_rejects_insufficient_resources_without_broadcast():
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        game_loop_manager.start = Mock()

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    started = start_two_player_websocket_game(
                        host_ws,
                        player_ws,
                    )
                    host_player_id = started["host_player_id"]
                    node_id = started["game"]["players"][host_player_id][
                        "owned_node_ids"
                    ][0]

                    host_ws.send_json(
                        {
                            "type": "UPGRADE_NODE",
                            "request_id": "req_upgrade_to_k2",
                            "node_id": node_id,
                        }
                    )
                    acknowledgement = host_ws.receive_json()
                    assert acknowledgement["type"] == "NODE_UPGRADED"
                    host_game_state = host_ws.receive_json()
                    player_ws.receive_json()  # GAME_STATE

                    assert host_game_state["game"]["nodes"][node_id][
                        "defence_level"
                    ] == "K2"
                    assert host_game_state["game"]["players"][
                        host_player_id
                    ]["resources"] == 10.0

                    for request_id in (
                        "req_upgrade_without_resources",
                        "req_upgrade_without_resources_probe",
                    ):
                        host_ws.send_json(
                            {
                                "type": "UPGRADE_NODE",
                                "request_id": request_id,
                                "node_id": node_id,
                            }
                        )

                        response = host_ws.receive_json()
                        assert response["type"] == "ERROR"
                        assert response["request_id"] == request_id
                        assert response["code"] == (
                            "INSUFFICIENT_RESOURCES"
                        )
        finally:
            game_loop_manager.start = original_start


def test_enemy_spawn_is_protected_and_normal_attack_still_starts():
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        game_loop_manager.start = Mock()

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    started = start_two_player_websocket_game(
                        host_ws,
                        player_ws,
                    )
                    game = started["game"]
                    alice_id = started["host_player_id"]
                    bob_id = started["player_id"]
                    alice_spawn_id = game["players"][alice_id][
                        "spawn_node_id"
                    ]
                    bob_spawn_id = game["players"][bob_id][
                        "spawn_node_id"
                    ]

                    player_ws.send_json(
                        {
                            "type": "ATTACK_NODE",
                            "request_id": "req_attack_spawn",
                            "node_id": alice_spawn_id,
                        }
                    )

                    rejected = player_ws.receive_json()
                    assert rejected["type"] == "ERROR"
                    assert rejected["request_id"] == "req_attack_spawn"
                    assert rejected["code"] == "SPAWN_NODE_PROTECTED"

                    spawn_ids = {
                        player["spawn_node_id"]
                        for player in game["players"].values()
                    }
                    normal_target_id = next(
                        node_id
                        for node_id in game["nodes"][bob_spawn_id][
                            "neighbor_ids"
                        ]
                        if node_id not in spawn_ids
                        and game["nodes"][node_id]["owner_id"] != bob_id
                    )

                    player_ws.send_json(
                        {
                            "type": "ATTACK_NODE",
                            "request_id": "req_attack_normal",
                            "node_id": normal_target_id,
                        }
                    )

                    attack_started = player_ws.receive_json()
                    assert attack_started["type"] == "ATTACK_STARTED"
                    assert attack_started["request_id"] == (
                        "req_attack_normal"
                    )
                    assert attack_started["node_id"] == normal_target_id

                    player_game_state = player_ws.receive_json()
                    host_game_state = host_ws.receive_json()
                    assert (
                        player_game_state["game"]
                        == host_game_state["game"]
                    )

                    updated_game = player_game_state["game"]
                    assert updated_game["nodes"][alice_spawn_id][
                        "owner_id"
                    ] == alice_id
                    assert updated_game["nodes"][alice_spawn_id][
                        "active_attack_player_id"
                    ] is None
                    assert all(
                        task["node_id"] != alice_spawn_id
                        for task in updated_game["tasks"].values()
                    )
        finally:
            game_loop_manager.start = original_start


def test_gameplay_requests_after_finish_are_rejected():
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        game_loop_manager.start = Mock()

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    started = start_two_player_websocket_game(
                        host_ws,
                        player_ws,
                    )

                    should_continue = run_final_tick(
                        client,
                        started["room_id"],
                        started["game_id"],
                    )

                    assert should_continue is False

                    host_player_id = started["host_player_id"]
                    own_node_id = started["game"]["players"][
                        host_player_id
                    ]["owned_node_ids"][0]
                    enemy_node_id = started["game"]["players"][
                        started["player_id"]
                    ]["owned_node_ids"][0]
                    attack_request = {
                        "type": "ATTACK_NODE",
                        "request_id": "req_attack_after_finish",
                        "node_id": enemy_node_id,
                    }
                    host_ws.send_json(attack_request)

                    final_state = host_ws.receive_json()
                    finished = host_ws.receive_json()

                    assert final_state["type"] == "GAME_STATE"
                    assert final_state["game"]["status"] == "finished"
                    assert finished["type"] == "GAME_FINISHED"

                    attack_response = host_ws.receive_json()
                    player_ws.receive_json()  # final GAME_STATE
                    player_ws.receive_json()  # GAME_FINISHED
                    assert attack_response["type"] == "ERROR"
                    assert attack_response["request_id"] == (
                        attack_request["request_id"]
                    )
                    assert attack_response["code"] == "GAME_NOT_RUNNING"

                    upgrade_request = {
                        "type": "UPGRADE_NODE",
                        "request_id": "req_upgrade_after_finish",
                        "node_id": own_node_id,
                    }
                    host_ws.send_json(upgrade_request)
                    upgrade_response = host_ws.receive_json()
                    assert upgrade_response["type"] == "ERROR"
                    assert upgrade_response["request_id"] == (
                        upgrade_request["request_id"]
                    )
                    assert upgrade_response["code"] == "GAME_NOT_RUNNING"

                    persisted = client.portal.call(
                        get_test_game,
                        started["game_id"],
                    )
                    assert persisted.status == GameStatus.FINISHED
                    assert persisted.model_dump(mode="json") == (
                        final_state["game"]
                    )
        finally:
            game_loop_manager.start = original_start


@pytest.mark.parametrize(
    "message_type",
    ["ANSWER_TASK", "CANCEL_ATTACK"],
)
def test_active_task_cannot_mutate_game_after_timeout(message_type):
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        game_loop_manager.start = Mock()

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    attack = start_two_player_websocket_attack(
                        host_ws,
                        player_ws,
                    )
                    score_before = client.portal.call(
                        get_test_game,
                        attack["game_id"],
                    ).players[attack["host_player_id"]].score

                    should_continue = run_final_tick(
                        client,
                        attack["room_id"],
                        attack["game_id"],
                    )
                    assert should_continue is False

                    request = {
                        "type": message_type,
                        "request_id": f"req_{message_type.lower()}_after_finish",
                        "task_id": attack["task"]["id"],
                    }
                    if message_type == "ANSWER_TASK":
                        request["answer"] = "answer"
                    host_ws.send_json(request)

                    final_state = host_ws.receive_json()
                    finished = host_ws.receive_json()

                    assert final_state["type"] == "GAME_STATE"
                    assert finished["type"] == "GAME_FINISHED"

                    response = host_ws.receive_json()
                    player_ws.receive_json()  # final GAME_STATE
                    player_ws.receive_json()  # GAME_FINISHED
                    assert final_state["game"]["tasks"] == {}
                    assert final_state["game"]["nodes"][
                        attack["target_node_id"]
                    ]["active_attack_player_id"] is None

                    assert response["type"] == "ERROR"
                    assert response["code"] == "GAME_NOT_RUNNING"

                    persisted = client.portal.call(
                        get_test_game,
                        attack["game_id"],
                    )
                    assert persisted.status == GameStatus.FINISHED
                    assert persisted.tasks == {}
                    assert persisted.players[
                        attack["host_player_id"]
                    ].score == score_before
        finally:
            game_loop_manager.start = original_start


def test_create_and_join_issue_private_session_tokens():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            host_ws.send_json({
                "type": "CREATE_ROOM",
                "request_id": "req_session_create",
                "nickname": "Alice",
            })
            host_room_state = host_ws.receive_json()
            host_created = host_ws.receive_json()

            assert host_created["session_token"]
            assert "session_token" not in host_room_state
            assert "session_token" not in host_room_state["you"]

            with client.websocket_connect("/ws") as player_ws:
                player_ws.send_json({
                    "type": "JOIN_ROOM",
                    "request_id": "req_session_join",
                    "room_id": host_created["room_id"],
                    "nickname": "Bob",
                })
                player_room_state = player_ws.receive_json()
                player_joined = player_ws.receive_json()
                host_update = host_ws.receive_json()

                assert player_joined["session_token"]
                assert player_joined["session_token"] != (
                    host_created["session_token"]
                )
                assert "session_token" not in player_room_state
                assert "session_token" not in host_update


def test_resume_running_game_preserves_identity_and_replays_snapshots():
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        game_loop_manager.start = Mock()

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    started = start_two_player_websocket_game(
                        host_ws,
                        player_ws,
                    )
                    client.portal.call(
                        update_resume_test_state,
                        started["game_id"],
                        started["host_player_id"],
                    )

                    with client.websocket_connect("/ws") as resumed_ws:
                        resumed_ws.send_json({
                            "type": "RESUME_SESSION",
                            "request_id": "req_resume_running",
                            "session_token": started[
                                "host_session_token"
                            ],
                        })

                        resumed = resumed_ws.receive_json()
                        room_state = resumed_ws.receive_json()
                        game_state = resumed_ws.receive_json()

                        assert resumed == {
                            "type": "SESSION_RESUMED",
                            "request_id": "req_resume_running",
                            "player_id": started["host_player_id"],
                            "room_id": started["room_id"],
                            "is_host": True,
                            "game_id": started["game_id"],
                        }
                        assert room_state["type"] == "ROOM_STATE"
                        assert room_state["you"]["id"] == (
                            started["host_player_id"]
                        )
                        assert game_state["type"] == "GAME_STATE"
                        assert game_state["game"][
                            "remaining_time_seconds"
                        ] == 321
                        assert game_state["game"]["players"][
                            started["host_player_id"]
                        ]["resources"] == 77

                        room = client.portal.call(
                            app.state.room_repository.get_room,
                            started["room_id"],
                        )
                        assert room.player_ids.count(
                            started["host_player_id"]
                        ) == 1
                        assert started["host_player_id"] in (
                            app.state.connection_manager.connections
                        )
                        assert app.state.connection_manager.player_rooms[
                            started["host_player_id"]
                        ] == started["room_id"]

                    with client.websocket_connect("/ws") as duplicate_ws:
                        duplicate_ws.send_json({
                            "type": "RESUME_SESSION",
                            "request_id": "req_resume_duplicate",
                            "session_token": started[
                                "host_session_token"
                            ],
                        })
                        assert duplicate_ws.receive_json()["type"] == (
                            "SESSION_RESUMED"
                        )
                        duplicate_ws.receive_json()  # ROOM_STATE
                        duplicate_ws.receive_json()  # GAME_STATE

                        room = client.portal.call(
                            app.state.room_repository.get_room,
                            started["room_id"],
                        )
                        assert room.player_ids.count(
                            started["host_player_id"]
                        ) == 1
        finally:
            game_loop_manager.start = original_start


def test_invalid_session_is_rejected_without_player_binding():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json({
                "type": "RESUME_SESSION",
                "request_id": "req_invalid_session",
                "session_token": "not-a-valid-token",
            })

            response = websocket.receive_json()

            assert response["type"] == "ERROR"
            assert response["request_id"] == "req_invalid_session"
            assert response["code"] == "INVALID_SESSION"
            assert app.state.connection_manager.connections == {}


def test_finished_game_resume_replays_persisted_result():
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        game_loop_manager.start = Mock()

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    started = start_two_player_websocket_game(
                        host_ws,
                        player_ws,
                    )
                    run_final_tick(
                        client,
                        started["room_id"],
                        started["game_id"],
                    )

                    with client.websocket_connect("/ws") as resumed_ws:
                        resumed_ws.send_json({
                            "type": "RESUME_SESSION",
                            "request_id": "req_resume_finished",
                            "session_token": started[
                                "host_session_token"
                            ],
                        })

                        assert resumed_ws.receive_json()["type"] == (
                            "SESSION_RESUMED"
                        )
                        assert resumed_ws.receive_json()["type"] == (
                            "ROOM_STATE"
                        )
                        game_state = resumed_ws.receive_json()
                        finished = resumed_ws.receive_json()

                        assert game_state["type"] == "GAME_STATE"
                        assert game_state["game"]["status"] == "finished"
                        assert finished == {
                            "type": "GAME_FINISHED",
                            "game_id": started["game_id"],
                            "winner_id": game_state["game"]["winner_id"],
                            "scores": {
                                player_id: player["score"]
                                for player_id, player
                                in game_state["game"]["players"].items()
                            },
                        }
        finally:
            game_loop_manager.start = original_start


def test_active_task_survives_resume_and_can_be_answered():
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        original_task_manager = app.state.task_manager
        original_loop_task_manager = game_loop_manager.task_manager
        test_task_manager = create_test_websocket_task_manager()
        game_loop_manager.start = Mock()
        game_loop_manager.task_manager = test_task_manager
        app.state.task_manager = test_task_manager

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    attack = start_two_player_websocket_attack(
                        host_ws,
                        player_ws,
                    )
                    task_id = attack["task"]["id"]

                    with client.websocket_connect("/ws") as resumed_ws:
                        resumed_ws.send_json({
                            "type": "RESUME_SESSION",
                            "request_id": "req_resume_task",
                            "session_token": attack[
                                "host_session_token"
                            ],
                        })
                        resumed_ws.receive_json()  # SESSION_RESUMED
                        resumed_ws.receive_json()  # ROOM_STATE
                        game_state = resumed_ws.receive_json()

                        assert task_id in game_state["game"]["tasks"]
                        assert task_id in app.state.task_manager.tasks

                        resumed_ws.send_json({
                            "type": "ANSWER_TASK",
                            "request_id": "req_answer_resumed",
                            "task_id": task_id,
                            "answer": "answer",
                        })
                        resolved = resumed_ws.receive_json()
                        updated = resumed_ws.receive_json()

                        assert resolved["type"] == "ATTACK_RESOLVED"
                        assert resolved["success"] is True
                        assert task_id not in updated["game"]["tasks"]
        finally:
            game_loop_manager.start = original_start
            game_loop_manager.task_manager = original_loop_task_manager
            app.state.task_manager = original_task_manager


def test_lobby_leave_acknowledges_invalidates_session_and_updates_room():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            host_ws.send_json({
                "type": "CREATE_ROOM",
                "request_id": "req_create_leave",
                "nickname": "Alice",
            })
            host_ws.receive_json()
            created = host_ws.receive_json()

            with client.websocket_connect("/ws") as player_ws:
                player_ws.send_json({
                    "type": "JOIN_ROOM",
                    "request_id": "req_join_leave",
                    "room_id": created["room_id"],
                    "nickname": "Bob",
                })
                player_ws.receive_json()
                joined = player_ws.receive_json()
                host_ws.receive_json()

                player_ws.send_json({
                    "type": "LEAVE_ROOM",
                    "request_id": "req_leave_bob",
                })

                assert player_ws.receive_json() == {
                    "type": "ROOM_LEFT",
                    "request_id": "req_leave_bob",
                    "room_id": created["room_id"],
                }
                updated = host_ws.receive_json()
                assert updated["type"] == "ROOM_STATE"
                assert [
                    player["id"]
                    for player in updated["players"]
                ] == [created["player_id"]]

                room = client.portal.call(
                    app.state.room_repository.get_room,
                    created["room_id"],
                )
                assert room.player_ids == [created["player_id"]]
                assert joined["player_id"] not in room.player_nicknames

                with client.websocket_connect("/ws") as resumed_ws:
                    resumed_ws.send_json({
                        "type": "RESUME_SESSION",
                        "request_id": "req_resume_left",
                        "session_token": joined["session_token"],
                    })
                    invalid = resumed_ws.receive_json()
                    assert invalid["type"] == "ERROR"
                    assert invalid["code"] == "INVALID_SESSION"


def test_host_lobby_leave_transfers_host_to_first_remaining_player():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as host_ws:
            with client.websocket_connect("/ws") as player_ws:
                host_ws.send_json({
                    "type": "CREATE_ROOM",
                    "request_id": "req_host_leave_create",
                    "nickname": "Alice",
                })
                host_ws.receive_json()
                created = host_ws.receive_json()
                player_ws.send_json({
                    "type": "JOIN_ROOM",
                    "request_id": "req_host_leave_join",
                    "room_id": created["room_id"],
                    "nickname": "Bob",
                })
                player_ws.receive_json()
                joined = player_ws.receive_json()
                host_ws.receive_json()

                host_ws.send_json({
                    "type": "LEAVE_ROOM",
                    "request_id": "req_host_leave",
                })

                assert host_ws.receive_json()["type"] == "ROOM_LEFT"
                updated = player_ws.receive_json()
                assert updated["type"] == "ROOM_STATE"
                assert updated["you"]["id"] == joined["player_id"]
                assert updated["you"]["isHost"] is True

                room = client.portal.call(
                    app.state.room_repository.get_room,
                    created["room_id"],
                )
                assert room.host_id == joined["player_id"]


def test_running_game_rejects_leave_without_mutating_session_or_membership():
    with TestClient(app) as client:
        game_loop_manager = app.state.game_loop_manager
        original_start = game_loop_manager.start
        game_loop_manager.start = Mock()

        try:
            with client.websocket_connect("/ws") as host_ws:
                with client.websocket_connect("/ws") as player_ws:
                    started = start_two_player_websocket_game(
                        host_ws,
                        player_ws,
                    )
                    token = started["host_session_token"]

                    host_ws.send_json({
                        "type": "LEAVE_ROOM",
                        "request_id": "req_running_leave",
                    })
                    error = host_ws.receive_json()

                    assert error["type"] == "ERROR"
                    assert error["code"] == (
                        "LEAVE_NOT_ALLOWED_AFTER_GAME_START"
                    )
                    room = client.portal.call(
                        app.state.room_repository.get_room,
                        started["room_id"],
                    )
                    game = client.portal.call(
                        app.state.game_repository.get_game,
                        started["game_id"],
                    )
                    assert started["host_player_id"] in room.player_ids
                    assert started["host_player_id"] in game.players
                    assert app.state.session_registry.get(token) is not None
        finally:
            game_loop_manager.start = original_start
