import secrets

from models import (
    DefenceLevel,
    Task,
    TaskResolution,
    TaskTemplate,
)


class TaskManager:
    def __init__(
        self,
        templates: list[TaskTemplate],
    ):
        self.templates = templates
        self.tasks: dict[str, Task] = {}

        self._next_indices = {
            defence_level: 0
            for defence_level in DefenceLevel
        }

    def get_template_for_defence(
        self,
        defence_level: DefenceLevel,
    ) -> TaskTemplate:
        matching_templates = [
            template
            for template in self.templates
            if template.difficulty == defence_level
        ]

        if not matching_templates:
            raise ValueError(
                "NO_TASK_TEMPLATE_FOR_DEFENCE_LEVEL"
            )

        index = self._next_indices[defence_level]
        template = matching_templates[index]

        self._next_indices[defence_level] = (
            index + 1
        ) % len(matching_templates)

        return template

    def create_task(
        self,
        node_id: str,
        player_id: str,
        defence_level: DefenceLevel,
    ) -> Task:
        template = self.get_template_for_defence(
            defence_level
        )

        task = Task(
            id=secrets.token_hex(8),
            node_id=node_id,
            player_id=player_id,
            defence_level=defence_level,
            template_id=template.id,
            question=template.question,
        )

        self.tasks[task.id] = task

        return task

    def check_answer(
        self,
        task_id: str,
        player_id: str,
        answer: str,
    ) -> TaskResolution:
        task = self.get_task(task_id)

        if task is None:
            raise ValueError("TASK_NOT_FOUND")

        if task.player_id != player_id:
            raise ValueError("TASK_NOT_OWNED")

        normalized_answer = self.normalize_answer(answer)

        if not normalized_answer:
            raise ValueError("ANSWER_EMPTY")

        template = self._get_template_by_id(
            task.template_id
        )

        accepted_answers = [
            template.answer,
            *template.accepted_answers,
        ]

        success = any(
            normalized_answer
            == self.normalize_answer(candidate)
            for candidate in accepted_answers
        )

        if success:
            return TaskResolution(
                success=True,
                score_change=0,
                explanation=template.explanation,
            )

        return TaskResolution(
            success=False,
            score_change=0,
            theory=template.theory,
        )

    @staticmethod
    def normalize_answer(answer: str) -> str:
        return " ".join(
            answer.strip().casefold().split()
        )    


    def _get_template_by_id(
        self,
        template_id: str,
    ) -> TaskTemplate:
        for template in self.templates:
            if template.id == template_id:
                return template

        raise ValueError(
            "TASK_TEMPLATE_NOT_FOUND"
        )


    def get_task(self, task_id: str) -> Task:
        task = self.tasks.get(task_id)

        if task is None:
            raise ValueError("TASK_NOT_FOUND")

        return task    


    def remove_task(self, task_id: str) -> None:
        if task_id not in self.tasks:
            raise ValueError("TASK_NOT_FOUND")

        del self.tasks[task_id]
