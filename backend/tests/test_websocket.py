from fastapi.testclient import TestClient
from network_models import RoomStateMessage
from main import app


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

                assert {
                    player["id"]
                    for player in host_updated_state["players"]
                } == {
                    host_player_id,
                    player_joined["player_id"],
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