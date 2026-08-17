import secrets


ROOM_ID_LENGTH = 6
ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
MAX_ROOM_ID_GENERATION_ATTEMPTS = 10

def generate_room_id() -> str:
    return "".join(
        secrets.choice(ROOM_ID_ALPHABET)
        for _ in range(ROOM_ID_LENGTH)
    )


async def generate_unique_room_id(redis_client) -> str:
    for _ in range(MAX_ROOM_ID_GENERATION_ATTEMPTS):
        room_id = generate_room_id()

        exists = await redis_client.exists(
            f"room:{room_id}"
        )

        if not exists:
            return room_id

    raise RuntimeError("ROOM_ID_GENERATION_FAILED")