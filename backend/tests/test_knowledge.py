from collections import Counter
import hashlib

import pytest

from knowledge_logic import (
    is_challenge_answer_correct,
    normalize_knowledge_answer,
    select_access_challenge,
)
from knowledge_pool import (
    ACCESS_CHALLENGES,
    ACCESS_CHALLENGES_BY_ID,
    KNOWLEDGE_MODULES,
    KNOWLEDGE_MODULES_BY_ID,
)
from models import AccessChallenge, GameState, KnowledgeModule, Player
from task_pool import TASK_POOL


EXPECTED_GATE_IDS = {
    "data_encoding": [
        "gate_caesar_001",
        "gate_rot13_001",
        "gate_xor_001",
    ],
    "classical_ciphers": [
        "gate_caesar_002",
        "gate_rot13_002",
        "gate_xor_002",
    ],
    "crypto_fundamentals": [
        "gate_caesar_003",
        "gate_rot13_003",
        "gate_xor_003",
    ],
    "password_security": [
        "gate_caesar_004",
        "gate_rot13_004",
        "gate_xor_004",
    ],
    "identity_access": [
        "gate_caesar_005",
        "gate_rot13_005",
        "gate_xor_005",
    ],
    "secure_practice": [
        "gate_caesar_006",
        "gate_rot13_006",
        "gate_xor_006",
    ],
    "tls_pki": [
        "gate_caesar_007",
        "gate_rot13_007",
        "gate_xor_007",
    ],
    "integrity_authenticity": [
        "gate_caesar_008",
        "gate_rot13_008",
        "gate_xor_008",
    ],
    "modern_encryption": [
        "gate_caesar_009",
        "gate_rot13_009",
        "gate_xor_009",
    ],
    "protocol_security": [
        "gate_caesar_010",
        "gate_rot13_010",
        "gate_xor_010",
    ],
    "session_key_management": [
        "gate_caesar_011",
        "gate_rot13_011",
        "gate_xor_011",
    ],
}


def test_knowledge_pool_has_exact_frozen_structure():
    assert len(KNOWLEDGE_MODULES) == 11
    assert len(KNOWLEDGE_MODULES_BY_ID) == 11
    assert len(ACCESS_CHALLENGES) == 33
    assert len(ACCESS_CHALLENGES_BY_ID) == 33

    module_ids = [module.id for module in KNOWLEDGE_MODULES]
    challenge_ids = [challenge.id for challenge in ACCESS_CHALLENGES]

    assert len(module_ids) == len(set(module_ids))
    assert len(challenge_ids) == len(set(challenge_ids))
    assert Counter(
        challenge_id.split("_")[1]
        for challenge_id in challenge_ids
    ) == {
        "caesar": 11,
        "rot13": 11,
        "xor": 11,
    }

    assert {
        module.id: module.gate_ids
        for module in KNOWLEDGE_MODULES
    } == EXPECTED_GATE_IDS

    for module in KNOWLEDGE_MODULES:
        assert isinstance(module, KnowledgeModule)
        assert module.content.strip()
        assert len(module.gate_ids) == 3
        assert all(
            gate_id in ACCESS_CHALLENGES_BY_ID
            for gate_id in module.gate_ids
        )

    for challenge in ACCESS_CHALLENGES:
        assert isinstance(challenge, AccessChallenge)
        assert challenge.accepted_answers == []


def test_every_task_template_knowledge_module_resolves():
    assert all(template.knowledge_module_id for template in TASK_POOL)
    assert all(
        template.knowledge_module_id in KNOWLEDGE_MODULES_BY_ID
        for template in TASK_POOL
    )


def test_deterministic_challenge_selection_is_stable_and_in_module_gates():
    selected = select_access_challenge(
        game_id="game_123",
        player_id="player_456",
        module_id="modern_encryption",
    )

    assert selected.id in EXPECTED_GATE_IDS["modern_encryption"]
    seed = "game_123\0player_456\0modern_encryption"
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    expected_index = int.from_bytes(digest[:8], "big") % 3
    assert selected.id == EXPECTED_GATE_IDS[
        "modern_encryption"
    ][expected_index]
    assert select_access_challenge(
        game_id="game_123",
        player_id="player_456",
        module_id="modern_encryption",
    ).id == selected.id


@pytest.mark.parametrize(
    ("raw_answer", "expected"),
    [
        (" DATA ", "data"),
        ("DaTa", "data"),
        ("  two   words  ", "two words"),
        ("0010", "0010"),
        ("10", "10"),
    ],
)
def test_knowledge_answer_normalization(raw_answer, expected):
    assert normalize_knowledge_answer(raw_answer) == expected


def test_xor_answer_keeps_leading_zeroes_significant():
    challenge = ACCESS_CHALLENGES_BY_ID["gate_xor_009"]

    assert is_challenge_answer_correct(challenge, " 0010 ") is True
    assert is_challenge_answer_correct(challenge, "10") is False


def test_player_unlocked_knowledge_survives_game_state_round_trip():
    player = Player(
        id="player_1",
        nickname="Alice",
        unlocked_knowledge_ids=[
            "data_encoding",
            "modern_encryption",
        ],
    )
    game = GameState(players={player.id: player})

    restored = GameState.model_validate(
        game.model_dump(mode="json")
    )

    assert restored.players[player.id].unlocked_knowledge_ids == [
        "data_encoding",
        "modern_encryption",
    ]


def test_player_unlocked_knowledge_default_is_not_shared():
    first = Player(id="player_1", nickname="Alice")
    second = Player(id="player_2", nickname="Bob")

    first.unlocked_knowledge_ids.append("data_encoding")

    assert second.unlocked_knowledge_ids == []
