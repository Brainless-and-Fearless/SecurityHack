import secrets


def generate_room_id() -> str:
    return secrets.token_hex(3).upper()


async def generate_unique_room_id(redis_client) -> str:
    for _ in range(20):
        room_id = generate_room_id()
        if not await redis_client.exists(f"room:{room_id}"):
            return room_id
    raise RuntimeError("ROOM_ID_GENERATION_FAILED")
