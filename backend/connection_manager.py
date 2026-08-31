class ConnectionManager:
    def __init__(self):
        self.connections = {}
        self.player_rooms = {}

    async def connect(
        self,
        player_id,
        room_id,
        websocket,
    ):
        old_websocket = self.connections.get(player_id)

        self.connections[player_id] = websocket
        self.player_rooms[player_id] = room_id

        if (
            old_websocket is not None
            and old_websocket is not websocket
        ):
            try:
                await old_websocket.close()
            except Exception:
                pass

    async def disconnect(
        self,
        player_id,
        websocket=None,
    ):
        if (
            websocket is not None
            and self.connections.get(player_id) is not websocket
        ):
            return

        self.connections.pop(player_id, None)
        self.player_rooms.pop(player_id, None)

    async def send_to_player(
        self,
        player_id,
        message,
    ):
        websocket = self.connections.get(player_id)

        if websocket is None:
            return

        try:
            await websocket.send_json(message)
        except Exception:
            await self.disconnect(player_id, websocket)

    async def broadcast_to_room(
        self,
        room_id,
        message,
    ):
        player_ids = [
            player_id
            for player_id, player_room_id
            in self.player_rooms.items()
            if player_room_id == room_id
        ]

        for player_id in player_ids:
            await self.send_to_player(
                player_id,
                message,
            )
