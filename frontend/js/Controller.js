import { AudioManager } from './AudioManager.js';

export class Controller {
    constructor(model, view, lobbyView, network, bestiaryView = null) {
        this.model = model;
        this.view = view;
        this.lobbyView = lobbyView;
        this.network = network;
        this.bestiaryView = bestiaryView;
        this.audio = new AudioManager();

        this.gameScreen = document.getElementById('game-screen');
        this.playerName = document.getElementById('player-name');
        this.playerScore = document.getElementById('player-score');
        this.playerResources = document.getElementById('player-resources');
        this.gameTimer = document.getElementById('game-timer');
        this.hudTimerItem = document.getElementById('hud-timer-item');
        this.connectionStatus = document.getElementById(
            'connection-status'
        );
        this.openBestiaryBtn = document.getElementById(
            'open-bestiary-btn'
        );

        this.taskModal = document.getElementById('task-modal');
        this.taskTitle = document.getElementById('task-title');
        this.taskTopic = document.getElementById('task-topic');
        this.taskDesc = document.getElementById('task-desc');
        this.taskAnswer = document.getElementById('task-answer');
        this.taskOptions = document.getElementById('task-options');
        this.submitTaskBtn = document.getElementById(
            'submit-task-btn'
        );
        this.cancelTaskBtn = document.getElementById(
            'cancel-task-btn'
        );
        this.taskOpenBestiaryBtn = document.getElementById(
            'task-open-bestiary-btn'
        );

        this.nodeUpgradePanel = document.getElementById(
            'node-upgrade-panel'
        );
        this.nodeUpgradeTitle = document.getElementById(
            'node-upgrade-title'
        );
        this.nodeUpgradeDetails = document.getElementById(
            'node-upgrade-details'
        );
        this.upgradeNodeBtn = document.getElementById(
            'upgrade-node-btn'
        );
        this.closeNodeUpgradeBtn = document.getElementById(
            'close-node-upgrade-btn'
        );

        this.gameFinishedPanel = document.getElementById(
            'game-finished-panel'
        );
        this.gameFinishedTitle = document.getElementById(
            'game-finished-title'
        );
        this.gameFinishedDetails = document.getElementById(
            'game-finished-details'
        );

        this.activeTask = null;
        this.taskResultEducation = null;
        this.choiceAnswerPending = false;
        this.taskOptionButtons = [];
        this.selectedUpgradeNodeId = null;
        this.isGameFinished = false;
        this.isResumingSession = false;
        this.knowledgeRefreshAfterResume = false;

        this._prevResources = null;
        this._prevScore = null;

        this.initEvents();
    }

    initEvents() {
        const lv = this.lobbyView;

        lv.modeCreateBtn.addEventListener(
            'click',
            () => lv.setEntryMode('create')
        );

        lv.modeJoinBtn.addEventListener(
            'click',
            () => lv.setEntryMode('join')
        );

        lv.entrySubmit.addEventListener(
            'click',
            () => this.handleEntrySubmit()
        );

        lv.copyBtn.addEventListener(
            'click',
            () => this.handleCopyCode()
        );

        lv.leaveBtn.addEventListener(
            'click',
            () => this.handleLeaveRoom()
        );

        lv.startBtn.addEventListener(
            'click',
            () => this.handleStartGame()
        );

        this.openBestiaryBtn?.addEventListener(
            'click',
            () => this.openBestiaryFromEntry()
        );

        lv.setEntryMode('create');
        lv.startAmbientLoop();

        this.submitTaskBtn?.addEventListener(
            'click',
            () => this.submitTaskAnswer()
        );

        this.cancelTaskBtn?.addEventListener(
            'click',
            () => this.handleCancelTask()
        );

        this.taskOpenBestiaryBtn?.addEventListener(
            'click',
            () => this.handleOpenTaskResultKnowledge()
        );

        this.upgradeNodeBtn?.addEventListener(
            'click',
            () => this.handleUpgradeNode()
        );

        this.closeNodeUpgradeBtn?.addEventListener(
            'click',
            () => this.closeNodeUpgradePanel()
        );

        document
            .getElementById('game-canvas')
            ?.addEventListener(
                'click',
                (event) => this.handleNodeClick(event)
            );

        this.bestiaryView?.setHandlers({
            onModuleSelected: (moduleId) => (
                this.handleKnowledgeModuleSelected(moduleId)
            ),
            onChallengeSubmit: (moduleId, challengeId, answer) => (
                this.handleKnowledgeChallengeSubmit(
                    moduleId,
                    challengeId,
                    answer,
                )
            ),
            onCloseRequested: () => this.closeBestiaryToEntry(),
        });
    }

    openBestiaryFromEntry() {
        if (
            this.network.connectionState === 'reconnecting'
            || typeof this.network.listKnowledge !== 'function'
        ) {
            return false;
        }

        this.lobbyView.hideAll?.();
        this.bestiaryView?.showForEntry?.();
        this.network.listKnowledge();
        return true;
    }

    closeBestiaryToEntry() {
        this.bestiaryView?.hide?.();
        this.lobbyView.showEntryScreen?.();
    }

    handleEntrySubmit() {
        const lv = this.lobbyView;

        lv.clearEntryErrors();

        const nickname = lv.nicknameInput.value.trim();

        if (!nickname) {
            lv.showEntryFieldError(
                'nickname',
                'Введите никнейм, чтобы продолжить'
            );
            return;
        }

        this.audio.unlock();

        if (lv.entryMode === 'join') {
            const code = lv.roomCodeInput.value
                .trim()
                .toUpperCase();

            if (!code) {
                lv.showEntryFieldError(
                    'roomCode',
                    'Введите код комнаты'
                );
                return;
            }

            this.network.joinRoom(
                nickname,
                code
            );
        } else {
            this.network.createRoom(
                nickname
            );
        }
    }

    onRoomState(room) {
        this.room = room;

        const gameStatus = this.model?.state?.status;

        if (gameStatus !== 'running' && gameStatus !== 'finished') {
            this.bestiaryView?.hide?.();
            this.lobbyView.showLobbyScreen();
        }

        this.lobbyView.renderRoom(room);
    }

    onSessionResumed() {
        this.isResumingSession = true;
        this.knowledgeRefreshAfterResume = true;
    }

    onNetworkError(message) {
        this.bestiaryView?.recoverChallengeSubmission?.();

        this.lobbyView.showToast(
            'error',
            message
        );
    }

    handleCopyCode() {
        if (!this.room) {
            return;
        }

        this.audio.playEffect('click');

        navigator.clipboard
            ?.writeText(this.room.roomCode)
            .catch(() => {});

        this.lobbyView.flashCopied();

        this.lobbyView.showToast(
            'info',
            'Код комнаты скопирован'
        );
    }

    handleLeaveRoom() {
        this.audio.resetForNewMatch();
        this.network.leaveRoom();
    }

    onRoomLeft() {
        this.room = null;
        this.bestiaryView?.hide?.();
        this.lobbyView.clearMapPreview();

        this.lobbyView.showEntryScreen();
        this.lobbyView.resetEntryForm();
    }

    handleStartGame() {
        this.audio.unlock();
        this.network.startGame();
    }

    onGameStarted() {
        this.lobbyView.runStartCountdown(
            () => this.startGame()
        );
    }

    onGameState(gameState) {
        const wasResumingSession = this.isResumingSession;

        this.model.applyGameState(
            gameState.gameId,
            gameState.game
        );

        this.updateHud();
        this.audio.updateMatchTimer(
            this.model.state.remainingTimeSeconds
        );

        this.view.render(
            Object.values(this.model.state.nodes)
        );

        this.refreshSelectedNodeUpgrade();

        if (
            wasResumingSession
            && this.model.state.status !== 'waiting'
        ) {
            this.lobbyView.stopAmbientLoop?.();
            this.lobbyView.hideAll?.();
            this.gameScreen?.classList.remove('hidden');
            this.bestiaryView?.showForGame?.();

            if (this.playerName && this.room?.you) {
                this.playerName.textContent = this.room.you.name;
            }

            if (this.model.state.status === 'running') {
                this.audio.startMusic();
            }

            this.isResumingSession = false;
        }

        const currentPlayerId = this.getCurrentPlayerId();
        const resumedTask = Object.values(
            this.model.state.tasks
            ?? gameState.game.tasks
            ?? {}
        ).find(
            (task) => task.player_id === currentPlayerId
        );

        if (
            resumedTask
            && (
                this.activeTask?.id !== resumedTask.id
                || wasResumingSession
            )
        ) {
            this.onAttackStarted({ task: resumedTask });
        }
    }

    startGame() {
        const nickname = this.room
            ? this.room.you.name
            : 'Игрок';

        this.audio.resetForNewMatch();
        this.audio.startMusic();

        this.lobbyView.stopAmbientLoop();
        this.lobbyView.hideAll();

        this.gameScreen.classList.remove(
            'hidden'
        );
        this.bestiaryView?.showForGame?.();

        this.playerName.textContent =
            nickname;

        this.updateHud();
        this.audio.updateMatchTimer(
            this.model.state.remainingTimeSeconds
        );

        this.view.render(
            Object.values(this.model.state.nodes)
        );

        this.requestKnowledgeCatalog();
    }

    isNetworkActionAvailable() {
        return (
            this.network.connectionState !== 'reconnecting'
            && this.network.connectionState !== 'disconnected'
        );
    }

    requestKnowledgeCatalog() {
        if (
            !this.isNetworkActionAvailable()
            || typeof this.network.listKnowledge !== 'function'
        ) {
            return false;
        }

        this.network.listKnowledge();
        return true;
    }

    handleKnowledgeModuleSelected(moduleId, beforeOpen = null) {
        if (
            !this.isNetworkActionAvailable()
            || typeof this.network.openKnowledge !== 'function'
        ) {
            return false;
        }

        beforeOpen?.();
        this.network.openKnowledge(moduleId);
        return true;
    }

    handleOpenTaskResultKnowledge() {
        const moduleId =
            this.taskResultEducation?.knowledge_module_id;

        if (!moduleId) {
            return false;
        }

        return this.handleKnowledgeModuleSelected(
            moduleId,
            () => {
                this.closeTaskModal();
                this.bestiaryView?.showForGame?.();
            },
        );
    }

    handleKnowledgeChallengeSubmit(moduleId, challengeId, answer) {
        if (
            !this.isNetworkActionAvailable()
            || typeof this.network.answerKnowledgeChallenge !== 'function'
        ) {
            return false;
        }

        this.network.answerKnowledgeChallenge(
            moduleId,
            challengeId,
            answer,
        );
        return true;
    }

    onKnowledgeCatalog(message) {
        this.bestiaryView?.renderCatalog(message.modules ?? []);
    }

    onKnowledgeOpened(message) {
        this.bestiaryView?.renderOpened(message.module);
    }

    onKnowledgeLocked(message) {
        this.bestiaryView?.renderLocked(message);
    }

    onKnowledgeChallengeFailed(message) {
        this.bestiaryView?.showChallengeFailure(message);
    }

    onKnowledgeUnlocked(message) {
        this.bestiaryView?.renderUnlocked(message.module);
    }

    updateHud() {
        const playerId = this.getCurrentPlayerId();

        const player = playerId
            ? this.model.state.players[playerId]
            : null;

        const score = player?.score ?? 0;
        const resources = player?.resources ?? 0;

        const remaining =
            this.model.state.remainingTimeSeconds ?? 0;

        this.playerScore.textContent =
            `Очки: ${score}`;

        this._flashChange(
            this.playerResources,
            this._prevResources,
            resources
        );

        this.playerResources.textContent =
            String(resources);

        this.gameTimer.textContent =
            this.formatTime(remaining);

        this._prevResources = resources;
        this._prevScore = score;

        if (this.hudTimerItem) {
            this.hudTimerItem.classList.toggle(
                'is-critical',
                remaining <= 60
            );

            this.hudTimerItem.classList.toggle(
                'is-warn',
                remaining > 60 &&
                remaining <= 180
            );
        }
    }

    _flashChange(
        element,
        previousValue,
        nextValue
    ) {
        if (
            previousValue === null ||
            nextValue === previousValue
        ) {
            return;
        }

        const className =
            nextValue > previousValue
                ? 'bump-up'
                : 'bump-down';

        element.classList.remove(
            'bump-up',
            'bump-down'
        );

        // Форсируем перезапуск анимации.
        void element.offsetWidth;

        element.classList.add(
            className
        );

        element.addEventListener(
            'animationend',
            () => {
                element.classList.remove(
                    className
                );
            },
            { once: true }
        );
    }

    getCurrentPlayerId() {
        return this.network.you?.id ?? null;
    }

    formatTime(totalSeconds) {
        const minutes =
            Math.floor(totalSeconds / 60);

        const seconds =
            totalSeconds % 60;

        return (
            `${String(minutes).padStart(2, '0')}:` +
            `${String(seconds).padStart(2, '0')}`
        );
    }

    handleNodeClick(event) {
        if (
            this.activeTask
            || this.isGameFinished
            || this.model.state.status === 'finished'
            || this.network.connectionState === 'reconnecting'
            || this.network.connectionState === 'disconnected'
        ) {
            return;
        }

        const nodes = Object.values(
            this.model.state.nodes
        );

        const nodeId = this.view.getNodeAtPoint(
            nodes,
            event.clientX,
            event.clientY
        );

        if (nodeId === null) {
            return;
        }

        this.audio.playEffect('click');

        const node = this.model.state.nodes[nodeId];
        const playerId = this.getCurrentPlayerId();

        if (node?.owner_id === playerId) {
            this.showNodeUpgradeAction(node);
            return;
        }

        this.network.attackNode(nodeId);
    }

    showNodeUpgradeAction(node) {
        const upgrades = {
            K1: { toLevel: 'K2', cost: 10 },
            K2: { toLevel: 'K3', cost: 20 },
        };
        const currentLevel = node.defence_level;
        const upgrade = upgrades[currentLevel];

        this.selectedUpgradeNodeId = node.id;

        if (this.nodeUpgradeTitle) {
            this.nodeUpgradeTitle.textContent =
                `Узел ${node.id} · защита ${currentLevel}`;
        }

        if (!upgrade) {
            if (this.nodeUpgradeDetails) {
                this.nodeUpgradeDetails.textContent =
                    'Максимальный уровень защиты K3';
            }
            if (this.upgradeNodeBtn) {
                this.upgradeNodeBtn.disabled = true;
                this.upgradeNodeBtn.classList.add('hidden');
            }
        } else {
            if (this.nodeUpgradeDetails) {
                this.nodeUpgradeDetails.textContent =
                    `${currentLevel} → ${upgrade.toLevel}. `
                    + `Стоимость: ${upgrade.cost}`;
            }
            if (this.upgradeNodeBtn) {
                this.upgradeNodeBtn.disabled = false;
                this.upgradeNodeBtn.classList.remove('hidden');
            }
        }

        this.nodeUpgradePanel?.classList.remove('hidden');
    }

    handleUpgradeNode() {
        if (
            this.isGameFinished
            || this.model.state.status === 'finished'
            || this.network.connectionState === 'reconnecting'
            || this.network.connectionState === 'disconnected'
            || !this.selectedUpgradeNodeId
            || this.upgradeNodeBtn?.disabled
        ) {
            return;
        }

        const node = this.model.state.nodes[
            this.selectedUpgradeNodeId
        ];

        if (!node || node.defence_level === 'K3') {
            return;
        }

        this.network.upgradeNode(
            this.selectedUpgradeNodeId
        );
    }

    onNodeUpgraded(message) {
        this.lobbyView.showToast(
            'success',
            `Защита узла улучшена: ${message.from_level} → ${message.to_level}`
        );
    }

    refreshSelectedNodeUpgrade() {
        if (!this.selectedUpgradeNodeId) {
            return;
        }

        const node = this.model.state.nodes[
            this.selectedUpgradeNodeId
        ];
        const playerId = this.getCurrentPlayerId();

        if (!node || node.owner_id !== playerId) {
            this.closeNodeUpgradePanel();
            return;
        }

        this.showNodeUpgradeAction(node);
    }

    closeNodeUpgradePanel() {
        this.nodeUpgradePanel?.classList.add('hidden');
        this.selectedUpgradeNodeId = null;
    }

    onAttackStarted(message) {
        if (this.isGameFinished) {
            return;
        }

        const task = message.task;

        this.resetTaskResultState();
        this.activeTask = task;
        this.choiceAnswerPending = false;

        const interactionType = (
            task.interaction_type ?? 'text_input'
        );

        if (interactionType === 'single_choice') {
            const options = Array.isArray(task.options)
                ? task.options
                : [];

            this.showTaskChoiceState(options);
        } else {
            this.showTaskInputState();
        }

        this.taskTitle.textContent =
            'Взлом узла';

        this.showTaskTopic(message.education);

        this.taskDesc.textContent =
            task.question;

        this.taskAnswer.value = '';

        if (this.cancelTaskBtn) {
            this.cancelTaskBtn.textContent =
                'Прервать';
        }

        this.taskModal.classList.remove(
            'hidden'
        );

        if (interactionType === 'text_input') {
            this.taskAnswer.focus();
        }
    }

    submitTaskAnswer() {
        if (
            !this.activeTask
            || this.network.connectionState === 'reconnecting'
            || this.network.connectionState === 'disconnected'
        ) {
            return;
        }

        const answer =
            this.taskAnswer.value.trim();

        if (!answer) {
            this.taskAnswer.classList.add(
                'input-error'
            );

            return;
        }

        this.taskAnswer.classList.remove(
            'input-error'
        );

        this.network.answerTask(
            this.activeTask.id,
            answer
        );
    }

    onAttackResolved(message) {
        this.activeTask = null;
        this.taskResultEducation = message.education ?? null;

        if (this.taskResultEducation?.knowledge_module_id) {
            this.taskOpenBestiaryBtn?.classList.remove('hidden');
        } else {
            this.taskOpenBestiaryBtn?.classList.add('hidden');
        }

        this.showTaskResultState();

        this.taskAnswer.classList.remove(
            'input-error'
        );
        this.taskAnswer.value = '';

        if (this.cancelTaskBtn) {
            this.cancelTaskBtn.textContent =
                'Продолжить';
        }

        const explanation =
            message.education?.explanation
            ?? message.explanation
            ?? message.theory
            ?? 'Объяснение отсутствует.';

        this.showTaskTopic(message.education);
        this.taskTitle.textContent = message.success
            ? 'Верно'
            : 'Неверно';
        this.taskDesc.textContent = explanation;

        this.taskModal.classList.remove('is-success-result');
        this.taskModal.classList.remove('is-failure-result');
        this.taskModal.classList.add(
            message.success
                ? 'is-success-result'
                : 'is-failure-result'
        );

        this.taskModal.classList.remove(
            'hidden'
        );

        if (message.success) {
            this.audio.playEffect('success');
            this.lobbyView.showToast(
                'success',
                `Узел захвачен! +${message.score_change} очков`
            );
            return;
        }

        this.audio.playEffect('wrong');
    }

    submitChoiceAnswer(optionText) {
        if (
            !this.activeTask
            || this.activeTask.interaction_type !== 'single_choice'
            || this.choiceAnswerPending
            || this.network.connectionState === 'reconnecting'
            || this.network.connectionState === 'disconnected'
        ) {
            return;
        }

        this.choiceAnswerPending = true;

        for (const button of this.taskOptionButtons) {
            button.disabled = true;
        }

        this.network.answerTask(
            this.activeTask.id,
            optionText
        );
    }

    showTaskInputState() {
        this.choiceAnswerPending = false;
        this.clearTaskOptions();

        this.taskAnswer.classList.remove(
            'hidden'
        );
        this.taskAnswer.disabled = false;

        this.submitTaskBtn?.classList.remove(
            'hidden'
        );

        if (this.submitTaskBtn) {
            this.submitTaskBtn.disabled = false;
        }
    }

    showTaskChoiceState(options) {
        this.choiceAnswerPending = false;

        this.taskAnswer.classList.add('hidden');
        this.taskAnswer.disabled = true;

        this.submitTaskBtn?.classList.add('hidden');

        if (this.submitTaskBtn) {
            this.submitTaskBtn.disabled = true;
        }

        this.clearTaskOptions();
        this.taskOptions?.classList.remove('hidden');

        for (const optionText of options) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'task-option-btn';
            button.textContent = optionText;
            button.addEventListener(
                'click',
                () => this.submitChoiceAnswer(optionText)
            );

            this.taskOptionButtons.push(button);
            this.taskOptions?.appendChild(button);
        }
    }

    clearTaskOptions() {
        this.taskOptions?.replaceChildren?.();
        this.taskOptions?.classList.add('hidden');
        this.taskOptionButtons = [];
    }

    showTaskResultState() {
        this.choiceAnswerPending = false;
        this.clearTaskOptions();

        this.taskAnswer.classList.add(
            'hidden'
        );
        this.taskAnswer.disabled = true;

        this.submitTaskBtn?.classList.add(
            'hidden'
        );

        if (this.submitTaskBtn) {
            this.submitTaskBtn.disabled = true;
        }
    }

    showTaskTopic(education) {
        const title = education?.knowledge_module_title;

        if (!title) {
            this.taskTopic?.classList.add('hidden');
            if (this.taskTopic) {
                this.taskTopic.textContent = '';
            }
            return;
        }

        this.taskTopic.textContent = `Тема: ${title}`;
        this.taskTopic.classList.remove('hidden');
    }

    resetTaskResultState() {
        this.taskResultEducation = null;
        this.taskModal?.classList.remove('is-success-result');
        this.taskModal?.classList.remove('is-failure-result');
        this.taskOpenBestiaryBtn?.classList.add('hidden');

        if (this.taskTopic) {
            this.taskTopic.textContent = '';
            this.taskTopic.classList.add('hidden');
        }
    }

    handleCancelTask() {
        if (!this.activeTask) {
            this.closeTaskModal();
            return;
        }

        if (
            this.network.connectionState === 'reconnecting'
            || this.network.connectionState === 'disconnected'
        ) {
            return;
        }

        this.network.cancelAttack(
            this.activeTask.id
        );
    }

    onAttackCancelled(message) {
        if (
            !this.activeTask
            || this.activeTask.id !== message.task_id
        ) {
            return;
        }

        this.closeTaskModal();
    }

    closeTaskModal() {
        this.taskModal.classList.add(
            'hidden'
        );

        this.taskAnswer.classList.remove(
            'input-error'
        );

        this.choiceAnswerPending = false;
        this.clearTaskOptions();
        this.activeTask = null;
        this.resetTaskResultState();

        if (this.taskTitle) {
            this.taskTitle.textContent = '';
        }
        if (this.taskDesc) {
            this.taskDesc.textContent = '';
        }
        if (this.taskAnswer) {
            this.taskAnswer.value = '';
        }
        if (this.cancelTaskBtn) {
            this.cancelTaskBtn.textContent = 'Прервать';
        }
    }

    onGameFinished(message) {
        this.isGameFinished = true;

        this.closeTaskModal();
        this.closeNodeUpgradePanel();

        const currentPlayerId = this.getCurrentPlayerId();
        const isWinner =
            message.winner_id !== null
            && message.winner_id === currentPlayerId;

        if (message.winner_id === null) {
            this.gameFinishedTitle.textContent = 'Ничья';
        } else if (isWinner) {
            this.gameFinishedTitle.textContent = 'Победа';
        } else {
            this.gameFinishedTitle.textContent = 'Поражение';
        }

        const scoreLines = Object.entries(message.scores)
            .map(([playerId, score]) => {
                const player = this.model.state.players[playerId];
                const nickname = player?.nickname ?? playerId;
                return `${nickname}: ${score}`;
            });

        const winner = message.winner_id
            ? this.model.state.players[message.winner_id]
            : null;
        const winnerLine = winner
            ? `Победитель: ${winner.nickname}\n`
            : '';

        this.gameFinishedDetails.textContent =
            `${winnerLine}Итоговый счёт:\n${scoreLines.join('\n')}`;

        this.gameFinishedPanel.classList.remove('hidden');

        this.audio.playFinishSequence(isWinner);
        this.requestKnowledgeCatalog();
    }

    onConnectionStateChange(state) {
        if (state === 'connected' && this.knowledgeRefreshAfterResume) {
            if (this.requestKnowledgeCatalog()) {
                this.knowledgeRefreshAfterResume = false;
            }
        }

        if (!this.connectionStatus) {
            return;
        }

        const reconnecting = state === 'reconnecting';
        this.connectionStatus.textContent = reconnecting
            ? 'Переподключение...'
            : '';
        this.connectionStatus.classList.toggle(
            'hidden',
            !reconnecting
        );
    }

}
