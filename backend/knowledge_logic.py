import hashlib

from knowledge_pool import (
    ACCESS_CHALLENGES_BY_ID,
    KNOWLEDGE_MODULES_BY_ID,
)
from models import AccessChallenge, GameState, GameStatus, KnowledgeModule


def normalize_knowledge_answer(answer: str) -> str:
    return " ".join(answer.strip().casefold().split())


def select_access_challenge(
    game_id: str,
    player_id: str,
    module_id: str,
) -> AccessChallenge:
    module = KNOWLEDGE_MODULES_BY_ID[module_id]
    seed = f"{game_id}\0{player_id}\0{module_id}"
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    index = int.from_bytes(digest[:8], "big") % len(module.gate_ids)
    challenge_id = module.gate_ids[index]
    return ACCESS_CHALLENGES_BY_ID[challenge_id]


def is_challenge_answer_correct(
    challenge: AccessChallenge,
    answer: str,
) -> bool:
    normalized_answer = normalize_knowledge_answer(answer)
    accepted_answers = [
        challenge.answer,
        *challenge.accepted_answers,
    ]

    return any(
        normalized_answer == normalize_knowledge_answer(candidate)
        for candidate in accepted_answers
    )


def get_knowledge_module(module_id: str) -> KnowledgeModule:
    module = KNOWLEDGE_MODULES_BY_ID.get(module_id)
    if module is None:
        raise ValueError("KNOWLEDGE_MODULE_NOT_FOUND")
    return module


def get_running_knowledge_player(game: GameState, player_id: str):
    if game.status != GameStatus.RUNNING:
        return None

    player = game.players.get(player_id)
    if player is None:
        raise ValueError("PLAYER_NOT_IN_GAME")
    return player


def is_knowledge_module_locked(
    game: GameState | None,
    player_id: str,
    module_id: str,
) -> bool:
    if game is None or game.status != GameStatus.RUNNING:
        return False

    player = get_running_knowledge_player(game, player_id)
    return module_id not in player.unlocked_knowledge_ids


def build_knowledge_catalog_module(
    module: KnowledgeModule,
    is_locked: bool,
) -> dict:
    return {
        "id": module.id,
        "title": module.title,
        "categories": list(module.categories),
        "is_locked": is_locked,
    }


def build_opened_knowledge_module(module: KnowledgeModule) -> dict:
    return {
        "id": module.id,
        "title": module.title,
        "categories": list(module.categories),
        "content": module.content,
    }


def build_locked_knowledge_module(module: KnowledgeModule) -> dict:
    return {
        "id": module.id,
        "title": module.title,
        "categories": list(module.categories),
    }


def build_knowledge_challenge_prompt(
    challenge: AccessChallenge,
) -> dict:
    return {
        "id": challenge.id,
        "question": challenge.question,
    }
