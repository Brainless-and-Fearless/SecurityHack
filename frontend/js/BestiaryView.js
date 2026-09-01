export class BestiaryView {
    constructor() {
        this.panel = document.getElementById('bestiary-panel');
        this.catalog = document.getElementById('bestiary-catalog');
        this.detail = document.getElementById('bestiary-detail');
        this.backButton = document.getElementById('bestiary-back-btn');
        this.closeButton = document.getElementById('bestiary-close-btn');
        this.moduleTitle = document.getElementById(
            'bestiary-module-title'
        );
        this.moduleCategories = document.getElementById(
            'bestiary-module-categories'
        );
        this.content = document.getElementById('bestiary-content');
        this.challenge = document.getElementById('bestiary-challenge');
        this.challengeQuestion = document.getElementById(
            'bestiary-challenge-question'
        );
        this.challengeAnswer = document.getElementById(
            'bestiary-challenge-answer'
        );
        this.challengeSubmit = document.getElementById(
            'bestiary-challenge-submit'
        );
        this.challengeFeedback = document.getElementById(
            'bestiary-challenge-feedback'
        );

        this.handlers = {};
        this.catalogButtons = new Map();
        this.activeChallenge = null;
        this.challengeSubmissionPending = false;

        this.backButton?.addEventListener('click', () => {
            this.showCatalog();
        });
        this.closeButton?.addEventListener('click', () => {
            this.handlers.onCloseRequested?.();
        });
        this.challengeSubmit?.addEventListener('click', () => {
            this.submitChallenge();
        });
    }

    setHandlers(handlers) {
        this.handlers = handlers ?? {};
    }

    renderCatalog(modules) {
        this.catalog?.replaceChildren();
        this.catalogButtons.clear();

        for (const module of modules ?? []) {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.moduleId = module.id;
            button.className = this._catalogButtonClass(module.is_locked);

            const title = document.createElement('span');
            title.className = 'bestiary-catalog-title';
            title.textContent = module.title;

            const status = document.createElement('span');
            status.className = 'bestiary-catalog-status';
            status.textContent = module.is_locked
                ? 'Зашифровано'
                : 'Доступно';

            button.appendChild(title);
            button.appendChild(status);
            button.addEventListener('click', () => {
                this.handlers.onModuleSelected?.(module.id);
            });

            this.catalogButtons.set(module.id, button);
            this.catalog?.appendChild(button);
        }

        this.panel?.classList.remove('hidden');
    }

    renderLocked({ module, challenge }) {
        this._renderModuleMetadata(module);
        this.activeChallenge = {
            moduleId: module.id,
            challengeId: challenge.id,
        };
        this.challengeSubmissionPending = false;

        this.content.textContent = '';
        this.content.classList.add('hidden');
        this.challengeQuestion.textContent = challenge.question;
        this.challengeAnswer.value = '';
        this.challengeAnswer.disabled = false;
        this.challengeSubmit.disabled = false;
        this.challengeFeedback.textContent = '';
        this.challenge.classList.remove('hidden');

        this._showDetail();
    }

    renderOpened(module) {
        this._renderArticle(module);
    }

    renderUnlocked(module) {
        this.markModuleReadable(module.id);
        this._renderArticle(module);
    }

    showChallengeFailure(message) {
        if (
            !this.activeChallenge
            || this.activeChallenge.moduleId !== message.module_id
            || this.activeChallenge.challengeId !== message.challenge_id
        ) {
            return;
        }

        this.challengeSubmissionPending = false;
        this.challengeAnswer.disabled = false;
        this.challengeSubmit.disabled = false;
        this.challengeFeedback.textContent = 'Неверный ответ. Попробуй ещё раз.';
    }

    recoverChallengeSubmission() {
        if (!this.activeChallenge || !this.challengeSubmissionPending) {
            return;
        }

        this.challengeSubmissionPending = false;
        this.challengeAnswer.disabled = false;
        this.challengeSubmit.disabled = false;
    }

    submitChallenge() {
        if (!this.activeChallenge || this.challengeSubmissionPending) {
            return;
        }

        const answer = this.challengeAnswer.value;
        if (!answer.trim()) {
            return;
        }

        const accepted = this.handlers.onChallengeSubmit?.(
            this.activeChallenge.moduleId,
            this.activeChallenge.challengeId,
            answer,
        );
        if (accepted === false) {
            return;
        }

        this.challengeSubmissionPending = true;
        this.challengeAnswer.disabled = true;
        this.challengeSubmit.disabled = true;
        this.challengeFeedback.textContent = '';
    }

    showCatalog() {
        this.detail?.classList.add('hidden');
        this.panel?.classList.remove('is-expanded');
    }

    showForEntry() {
        this.panel?.classList.remove('hidden');
        this.panel?.classList.add('is-entry-mode');
        this.closeButton?.classList.remove('hidden');
        this.showCatalog();
    }

    showForGame() {
        this.panel?.classList.remove('hidden');
        this.panel?.classList.remove('is-entry-mode');
        this.closeButton?.classList.add('hidden');
    }

    hide() {
        this.panel?.classList.add('hidden');
    }

    markModuleReadable(moduleId) {
        const button = this.catalogButtons.get(moduleId);
        if (!button) {
            return;
        }

        button.className = this._catalogButtonClass(false);
        const status = button.children[1];
        if (status) {
            status.textContent = 'Доступно';
        }
    }

    _renderArticle(module) {
        this._renderModuleMetadata(module);
        this.activeChallenge = null;
        this.challengeSubmissionPending = false;

        this.challenge.classList.add('hidden');
        this.challengeQuestion.textContent = '';
        this.challengeAnswer.value = '';
        this.challengeAnswer.disabled = false;
        this.challengeSubmit.disabled = false;
        this.challengeFeedback.textContent = '';

        this.content.textContent = module.content;
        this.content.classList.remove('hidden');

        this._showDetail();
    }

    _renderModuleMetadata(module) {
        this.moduleTitle.textContent = module.title;
        this.moduleCategories.textContent = (module.categories ?? []).join(' · ');
    }

    _showDetail() {
        this.detail?.classList.remove('hidden');
        this.panel?.classList.add('is-expanded');
    }

    _catalogButtonClass(isLocked) {
        return `bestiary-module-btn ${
            isLocked ? 'is-locked' : 'is-readable'
        }`;
    }
}
