import re

import pytest
from models import DefenceLevel, TaskTemplate
from task_manager import TaskManager
from task_pool import TASK_POOL

def test_task_template_contains_required_content_fields():
    template = TaskTemplate(
        id="encryption_k1_001",
        difficulty=DefenceLevel.K1,
        category="ENCRYPTION",
        question="Что нужно использовать для расшифрования сообщения?",
        answer="ключ",
        explanation="Расшифрование выполняется с использованием соответствующего ключа.",
        theory="Криптографический ключ используется алгоритмом для обратного преобразования защищённых данных.",
    )

    assert template.id == "encryption_k1_001"
    assert template.difficulty == DefenceLevel.K1
    assert template.category == "ENCRYPTION"
    assert template.question
    assert template.answer
    assert template.explanation
    assert template.theory



def test_task_manager_returns_template_for_requested_defence_level():
    templates = [
        TaskTemplate(
            id="encryption_k1_001",
            difficulty=DefenceLevel.K1,
            category="ENCRYPTION",
            question="Что нужно использовать для расшифрования сообщения?",
            answer="ключ",
            explanation="Для расшифрования используется соответствующий ключ.",
            theory="Криптографический ключ используется алгоритмом для обратного преобразования защищённых данных.",
        ),
        TaskTemplate(
            id="encryption_k2_001",
            difficulty=DefenceLevel.K2,
            category="ENCRYPTION",
            question="Какой класс алгоритмов использует общий секрет?",
            answer="симметричный",
            explanation="Симметричные алгоритмы используют общий секретный ключ.",
            theory="В симметричной криптографии один секретный ключ используется обеими сторонами.",
        ),
    ]

    manager = TaskManager(templates)

    template = manager.get_template_for_defence(
        DefenceLevel.K2
    )

    assert template.id == "encryption_k2_001"
    assert template.difficulty == DefenceLevel.K2


def test_task_manager_raises_when_no_template_exists_for_defence_level():
    templates = [
        TaskTemplate(
            id="encryption_k1_001",
            difficulty=DefenceLevel.K1,
            category="ENCRYPTION",
            question="Что такое открытый текст?",
            answer="plaintext",
            explanation="Открытый текст — исходные данные до шифрования.",
            theory="Шифрование преобразует plaintext в ciphertext.",
        ),
    ]

    manager = TaskManager(templates)

    with pytest.raises(
        ValueError,
        match="NO_TASK_TEMPLATE_FOR_DEFENCE_LEVEL",
    ):
        manager.get_template_for_defence(
            DefenceLevel.K3
        )    


def test_task_manager_can_select_different_templates_for_same_defence_level():
    templates = [
        TaskTemplate(
            id="encryption_k1_001",
            difficulty=DefenceLevel.K1,
            category="ENCRYPTION",
            question="Вопрос 1",
            answer="ответ 1",
            explanation="Объяснение 1",
            theory="Теория 1",
        ),
        TaskTemplate(
            id="encryption_k1_002",
            difficulty=DefenceLevel.K1,
            category="ENCRYPTION",
            question="Вопрос 2",
            answer="ответ 2",
            explanation="Объяснение 2",
            theory="Теория 2",
        ),
    ]

    manager = TaskManager(templates)

    first = manager.get_template_for_defence(
        DefenceLevel.K1
    )

    second = manager.get_template_for_defence(
        DefenceLevel.K1
    )

    assert {
        first.id,
        second.id,
    } == {
        "encryption_k1_001",
        "encryption_k1_002",
    }        


def test_task_manager_cycles_through_templates_for_same_defence_level():
    templates = [
        TaskTemplate(
            id="encryption_k1_001",
            difficulty=DefenceLevel.K1,
            category="ENCRYPTION",
            question="Вопрос 1",
            answer="ответ 1",
            explanation="Объяснение 1",
            theory="Теория 1",
        ),
        TaskTemplate(
            id="encryption_k1_002",
            difficulty=DefenceLevel.K1,
            category="ENCRYPTION",
            question="Вопрос 2",
            answer="ответ 2",
            explanation="Объяснение 2",
            theory="Теория 2",
        ),
    ]

    manager = TaskManager(templates)

    first = manager.get_template_for_defence(
        DefenceLevel.K1
    )

    second = manager.get_template_for_defence(
        DefenceLevel.K1
    )

    third = manager.get_template_for_defence(
        DefenceLevel.K1
    )

    assert first.id == "encryption_k1_001"
    assert second.id == "encryption_k1_002"
    assert third.id == "encryption_k1_001"    


def test_task_pool_contains_valid_templates_for_all_defence_levels():
    assert TASK_POOL
    assert len(TASK_POOL) == 75

    template_ids = [
        template.id
        for template in TASK_POOL
    ]

    assert len(template_ids) == len(set(template_ids))

    question_texts = [
        template.question
        for template in TASK_POOL
    ]

    assert len(question_texts) == len(set(question_texts))

    for template in TASK_POOL:
        assert isinstance(template, TaskTemplate)
        assert template.category
        assert template.question
        assert template.answer
        assert template.explanation
        assert template.theory
        assert not re.search(
            r'ответьте\s*:\s*[«"]',
            template.question,
            re.IGNORECASE,
        )

    difficulties = {
        template.difficulty
        for template in TASK_POOL
    }

    assert difficulties == {
        DefenceLevel.K1,
        DefenceLevel.K2,
        DefenceLevel.K3,
    }

    for difficulty in DefenceLevel:
        assert sum(
            template.difficulty == difficulty
            for template in TASK_POOL
        ) == 25


def test_task_manager_creates_active_task_from_template():
    manager = TaskManager(
        [
            TaskTemplate(
                id="encryption_k2_001",
                difficulty=DefenceLevel.K2,
                category="ENCRYPTION",
                question="Какой класс шифрования использует общий секрет?",
                answer="симметричный",
                explanation=(
                    "Симметричное шифрование использует "
                    "общий секретный ключ."
                ),
                theory=(
                    "При симметричном шифровании "
                    "один секретный ключ используется "
                    "для шифрования и расшифрования."
                ),
            )
        ]
    )

    task = manager.create_task(
        node_id="node_17",
        player_id="player_1",
        defence_level=DefenceLevel.K2,
    )

    assert task.node_id == "node_17"
    assert task.player_id == "player_1"
    assert task.defence_level == DefenceLevel.K2
    assert task.template_id == "encryption_k2_001"
    assert task.question == (
        "Какой класс шифрования использует общий секрет?"
    )    


def test_task_manager_creates_unique_task_ids():
    manager = TaskManager(
        [
            TaskTemplate(
                id="encryption_k1_001",
                difficulty=DefenceLevel.K1,
                category="ENCRYPTION",
                question="Question",
                answer="answer",
                explanation="Explanation",
                theory="Theory",
            )
        ]
    )

    first = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    second = manager.create_task(
        node_id="node_2",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    assert first.id != second.id    


def test_created_task_does_not_expose_template_answer_or_theory():
    manager = TaskManager(
        [
            TaskTemplate(
                id="encryption_k1_001",
                difficulty=DefenceLevel.K1,
                category="ENCRYPTION",
                question="Question",
                answer="secret_answer",
                explanation="Explanation",
                theory="Secret theory",
            )
        ]
    )

    task = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    assert not hasattr(task, "answer")
    assert not hasattr(task, "theory")

    assert task.template_id == "encryption_k1_001"
    assert task.question == "Question"    


def create_answer_test_manager():
    return TaskManager(
        [
            TaskTemplate(
                id="test_k1",
                difficulty=DefenceLevel.K1,
                category="TEST",
                question="Столица Франции?",
                answer="Париж",
                explanation="Париж является столицей Франции.",
                theory="Столица Франции — Париж.",
            )
        ]
    )    


def create_alias_answer_test_manager():
    return TaskManager(
        [
            TaskTemplate(
                id="firewall_k1",
                difficulty=DefenceLevel.K1,
                category="NETWORK_SECURITY",
                question="Что фильтрует сетевой трафик?",
                answer="межсетевой экран",
                accepted_answers=[
                    "firewall",
                    "защитный экран",
                ],
                explanation="Это межсетевой экран.",
                theory="Он применяет правила фильтрации трафика.",
            )
        ]
    )


def check_k1_answer(manager, answer):
    task = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    return manager.check_answer(
        task.id,
        "player_1",
        answer,
    )


def test_task_manager_accepts_canonical_answer_when_aliases_exist():
    resolution = check_k1_answer(
        create_alias_answer_test_manager(),
        "межсетевой экран",
    )

    assert resolution.success is True


def test_task_manager_accepts_explicit_answer_alias():
    resolution = check_k1_answer(
        create_alias_answer_test_manager(),
        "firewall",
    )

    assert resolution.success is True


def test_task_manager_normalizes_explicit_answer_alias():
    resolution = check_k1_answer(
        create_alias_answer_test_manager(),
        "  ЗАЩИТНЫЙ   ЭКРАН  ",
    )

    assert resolution.success is True


def test_task_manager_rejects_unlisted_answer_alias():
    resolution = check_k1_answer(
        create_alias_answer_test_manager(),
        "сетевой фильтр",
    )

    assert resolution.success is False


def test_task_template_accepted_answers_default_is_not_shared():
    first = TaskTemplate(
        id="first",
        difficulty=DefenceLevel.K1,
        category="TEST",
        question="First?",
        answer="first",
        explanation="First.",
        theory="First theory.",
    )
    second = TaskTemplate(
        id="second",
        difficulty=DefenceLevel.K1,
        category="TEST",
        question="Second?",
        answer="second",
        explanation="Second.",
        theory="Second theory.",
    )

    first.accepted_answers.append("alias")

    assert second.accepted_answers == []


def test_task_manager_accepts_correct_answer():
    manager = create_answer_test_manager()

    task = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    resolution = manager.check_answer(
        task.id,
        "player_1",
        "Париж",
    )

    assert resolution.success is True
    assert resolution.score_change == 0
    assert resolution.theory is None
    assert resolution.explanation == (
        "Париж является столицей Франции."
    )


def test_task_manager_rejects_incorrect_answer_and_returns_theory():
    manager = create_answer_test_manager()

    task = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    resolution = manager.check_answer(
        task.id,
        "player_1",
        "Лион",
    )

    assert resolution.success is False
    assert resolution.score_change == 0
    assert resolution.theory == (
        "Столица Франции — Париж."
    )


def test_task_manager_rejects_answer_for_unknown_task():
    manager = create_answer_test_manager()

    with pytest.raises(
        ValueError,
        match="TASK_NOT_FOUND",
    ):
        manager.check_answer(
            "missing_task",
            "player_1",
            "Париж",
        )        


def test_task_manager_rejects_answer_from_wrong_player():
    manager = create_answer_test_manager()

    task = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    with pytest.raises(
        ValueError,
        match="TASK_NOT_OWNED",
    ):
        manager.check_answer(
            task.id,
            "player_2",
            "Париж",
        )


def test_task_manager_rejects_empty_answer():
    manager = create_answer_test_manager()

    task = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    with pytest.raises(
        ValueError,
        match="ANSWER_EMPTY",
    ):
        manager.check_answer(
            task.id,
            "player_1",
            "   ",
        )                


def test_task_manager_normalizes_answer_before_comparison():
    manager = create_answer_test_manager()

    task = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    resolution = manager.check_answer(
        task.id,
        "player_1",
        "  пАРИЖ  ",
    )

    assert resolution.success is True        


def test_task_manager_can_get_active_task():
    manager = create_answer_test_manager()

    task = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    result = manager.get_task(task.id)

    assert result is task    


def test_task_manager_removes_active_task():
    manager = create_answer_test_manager()

    task = manager.create_task(
        node_id="node_1",
        player_id="player_1",
        defence_level=DefenceLevel.K1,
    )

    manager.remove_task(task.id)

    with pytest.raises(
        ValueError,
        match="TASK_NOT_FOUND",
    ):
        manager.get_task(task.id)    


def test_task_manager_cannot_remove_unknown_task():
    manager = create_answer_test_manager()

    with pytest.raises(
        ValueError,
        match="TASK_NOT_FOUND",
    ):
        manager.remove_task("missing_task")
