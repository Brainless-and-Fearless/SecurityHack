import string
import pytest
import redis.asyncio as redis

from room_id import generate_unique_room_id

@pytest.fixture
async def redis_client():
    client = redis.Redis(
        host="127.0.0.1",
        port=6379,
        decode_responses=True,
    )

    yield client

    await client.flushdb()
    await client.aclose()

from room_id import (
    ROOM_ID_ALPHABET,
    ROOM_ID_LENGTH,
    generate_room_id,
)


def test_room_id_has_correct_length():
    room_id = generate_room_id()

    assert len(room_id) == ROOM_ID_LENGTH
    assert ROOM_ID_LENGTH == 6


def test_room_id_contains_only_allowed_characters():
    room_id = generate_room_id()

    assert all(
        character in ROOM_ID_ALPHABET
        for character in room_id
    )


def test_room_id_does_not_contain_ambiguous_characters():
    room_id = generate_room_id()

    ambiguous_characters = {
        "0",
        "1",
        "I",
        "O",
    }

    assert all(
        character not in ambiguous_characters
        for character in room_id
    )


def test_room_id_alphabet_contains_expected_characters():
    expected_alphabet = (
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    )

    assert ROOM_ID_ALPHABET == expected_alphabet
    assert set(ROOM_ID_ALPHABET) == set(
        string.ascii_uppercase.replace("I", "").replace("O", "")
        + "23456789"
    )


@pytest.mark.anyio
async def test_unique_room_id_skips_existing_id(
    redis_client,
    monkeypatch,
):
    existing_id = "A7F3K2"

    await redis_client.set(
        f"room:{existing_id}",
        "occupied",
    )

    generated_ids = iter([
        existing_id,
        "B4Q8ZM",
    ])

    monkeypatch.setattr(
        "room_id.generate_room_id",
        lambda: next(generated_ids),
    )

    room_id = await generate_unique_room_id(
        redis_client,
    )

    assert room_id == "B4Q8ZM"    

@pytest.mark.anyio
async def test_unique_room_id_accepts_free_id(
    redis_client,
    monkeypatch,
):
    generated_id = "B4Q8ZM"

    monkeypatch.setattr(
        "room_id.generate_room_id",
        lambda: generated_id,
    )

    room_id = await generate_unique_room_id(
        redis_client,
    )

    assert room_id == generated_id    