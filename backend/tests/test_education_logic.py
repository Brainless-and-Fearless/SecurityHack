import pytest

from education_logic import (
    build_task_education_context,
    build_task_education_feedback,
)
from knowledge_pool import KNOWLEDGE_MODULES_BY_ID
from models import DefenceLevel, TaskInteractionType, TaskTemplate
from task_manager import TaskManager
from task_pool import TASK_POOL


def make_manager(interaction_type: TaskInteractionType) -> tuple[TaskManager, TaskTemplate]:
    template = TaskTemplate(
        id=f"education_{interaction_type.value}",
        difficulty=DefenceLevel.K1,
        category="TEST",
        question="Safe question",
        answer="correct",
        accepted_answers=["alias"],
        interaction_type=interaction_type,
        options=(
            ["wrong 1", "correct", "wrong 2", "wrong 3"]
            if interaction_type == TaskInteractionType.SINGLE_CHOICE
            else []
        ),
        knowledge_module_id="crypto_fundamentals",
        explanation="Authoritative frozen explanation.",
        theory="Legacy theory.",
    )
    return TaskManager([template]), template


@pytest.mark.parametrize(
    "interaction_type",
    [
        TaskInteractionType.TEXT_INPUT,
        TaskInteractionType.SINGLE_CHOICE,
    ],
)
def test_education_builders_use_authoritative_template_for_both_interactions(
    interaction_type,
):
    manager, template = make_manager(interaction_type)
    task = manager.create_task("node_1", "player_1", DefenceLevel.K1)

    context = build_task_education_context(task, manager)
    feedback = build_task_education_feedback(task, manager)
    module = KNOWLEDGE_MODULES_BY_ID[template.knowledge_module_id]

    assert context.model_dump() == {
        "knowledge_module_id": module.id,
        "knowledge_module_title": module.title,
    }
    assert feedback.model_dump() == {
        "knowledge_module_id": module.id,
        "knowledge_module_title": module.title,
        "explanation": template.explanation,
    }
    assert "theory" not in feedback.model_dump()
    assert "answer" not in feedback.model_dump()
    assert "accepted_answers" not in feedback.model_dump()
    assert "content" not in feedback.model_dump()


def test_all_frozen_tasks_have_valid_education_sources():
    assert len(TASK_POOL) == 75

    for template in TASK_POOL:
        assert template.knowledge_module_id
        assert template.knowledge_module_id in KNOWLEDGE_MODULES_BY_ID
        assert template.explanation.strip()
