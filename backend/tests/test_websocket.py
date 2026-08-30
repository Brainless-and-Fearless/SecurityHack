from fastapi.testclient import TestClient
from network_models import RoomStateMessage
from main import app
from task_manager import TaskManager
from models import DefenceLevel, TaskTemplate

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
        "task": attack_started["task"],
        "target_node_id": target_node_id,
        "host_player_id": host_player_id,
        "player_id": player_joined["player_id"],
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
