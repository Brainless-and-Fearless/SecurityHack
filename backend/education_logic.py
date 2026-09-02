from knowledge_logic import get_knowledge_module
from models import Task
from network_models import TaskEducationContext, TaskEducationFeedback
from task_manager import TaskManager


def _resolve_task_education(task: Task, task_manager: TaskManager):
    if task.template_id is None:
        raise ValueError("TASK_TEMPLATE_NOT_FOUND")

    template = task_manager.get_template_by_id(task.template_id)
    module_id = template.knowledge_module_id

    if not module_id:
        raise ValueError("KNOWLEDGE_MODULE_NOT_FOUND")

    module = get_knowledge_module(module_id)
    return template, module


def build_task_education_context(
    task: Task,
    task_manager: TaskManager,
) -> TaskEducationContext:
    _, module = _resolve_task_education(task, task_manager)
    return TaskEducationContext(
        knowledge_module_id=module.id,
        knowledge_module_title=module.title,
    )


def build_task_education_feedback(
    task: Task,
    task_manager: TaskManager,
) -> TaskEducationFeedback:
    template, module = _resolve_task_education(task, task_manager)
    return TaskEducationFeedback(
        knowledge_module_id=module.id,
        knowledge_module_title=module.title,
        explanation=template.explanation,
    )
