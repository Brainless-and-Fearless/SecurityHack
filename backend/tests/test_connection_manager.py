import pytest

from connection_manager import ConnectionManager


class FakeWebSocket:
    def __init__(self):
        self.messages = []
        self.closed = False

    async def send_json(self, message):
        self.messages.append(message)

    async def close(self):
        self.closed = True


@pytest.mark.anyio
async def test_player_can_connect():
    manager = ConnectionManager()
    websocket = FakeWebSocket()

    await manager.connect(
        "player_1",
        "room_1",
        websocket,
    )

    assert manager.connections["player_1"] is websocket
    assert manager.player_rooms["player_1"] == "room_1"


@pytest.mark.anyio
async def test_message_can_be_sent_to_player():
    manager = ConnectionManager()
    websocket = FakeWebSocket()

    await manager.connect(
        "player_1",
        "room_1",
        websocket,
    )

    message = {
        "type": "TEST",
        "value": 123,
    }

    await manager.send_to_player(
        "player_1",
        message,
    )

    assert websocket.messages == [message]


@pytest.mark.anyio
async def test_message_can_be_broadcast_to_room():
    manager = ConnectionManager()

    websocket_1 = FakeWebSocket()
    websocket_2 = FakeWebSocket()
    websocket_3 = FakeWebSocket()

    await manager.connect(
        "player_1",
        "room_1",
        websocket_1,
    )

    await manager.connect(
        "player_2",
        "room_1",
        websocket_2,
    )

    await manager.connect(
        "player_3",
        "room_2",
        websocket_3,
    )

    message = {
        "type": "GAME_STATE",
    }

    await manager.broadcast_to_room(
        "room_1",
        message,
    )

    assert websocket_1.messages == [message]
    assert websocket_2.messages == [message]
    assert websocket_3.messages == []


@pytest.mark.anyio
async def test_disconnected_player_does_not_receive_broadcast():
    manager = ConnectionManager()

    websocket_1 = FakeWebSocket()
    websocket_2 = FakeWebSocket()

    await manager.connect(
        "player_1",
        "room_1",
        websocket_1,
    )

    await manager.connect(
        "player_2",
        "room_1",
        websocket_2,
    )

    await manager.disconnect("player_1")

    message = {
        "type": "GAME_STATE",
    }

    await manager.broadcast_to_room(
        "room_1",
        message,
    )

    assert websocket_1.messages == []
    assert websocket_2.messages == [message]


@pytest.mark.anyio
async def test_reconnect_replaces_old_connection():
    manager = ConnectionManager()

    old_websocket = FakeWebSocket()
    new_websocket = FakeWebSocket()

    await manager.connect(
        "player_1",
        "room_1",
        old_websocket,
    )

    await manager.connect(
        "player_1",
        "room_1",
        new_websocket,
    )

    assert old_websocket.closed is True
    assert manager.connections["player_1"] is new_websocket
    assert manager.player_rooms["player_1"] == "room_1"


@pytest.mark.anyio
async def test_sending_to_unknown_player_does_nothing():
    manager = ConnectionManager()

    await manager.send_to_player(
        "unknown_player",
        {"type": "TEST"},
    )