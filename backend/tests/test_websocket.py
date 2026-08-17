from fastapi.testclient import TestClient

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

            room_state = first_response["room"]
            room_created = second_response

            assert room_state["id"] == room_created["room_id"]
            assert room_state["host_id"] == room_created["player_id"]
            assert room_created["request_id"] == "req_create"
            assert room_created["is_host"] is True

            assert room_state["player_ids"] == [
                room_created["player_id"]
            ]


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

                room = player_room_state["room"]

                assert room["id"] == room_id
                assert room["host_id"] == host_player_id

                assert room["player_ids"] == [
                    host_player_id,
                    player_joined["player_id"],
                ]

                assert player_joined["request_id"] == "req_join"
                assert player_joined["room_id"] == room_id
                assert player_joined["is_host"] is False

                host_updated_state = host_ws.receive_json()

                assert host_updated_state["type"] == "ROOM_STATE"
                assert host_updated_state["room"]["id"] == room_id

                assert host_updated_state["room"]["player_ids"] == [
                    host_player_id,
                    player_joined["player_id"],
                ]