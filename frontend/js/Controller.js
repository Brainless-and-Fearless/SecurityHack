export class Controller {
    constructor(model, view, lobbyView, network) {
        this.model = model;
        this.view = view;
        this.lobbyView = lobbyView;
        this.network = network;

        this.gameScreen = document.getElementById('game-screen');
        this.playerName = document.getElementById('player-name');
        this.playerScore = document.getElementById('player-score');
        this.playerResources = document.getElementById('player-resources');
        this.gameTimer = document.getElementById('game-timer');
        this.hudTimerItem = document.getElementById('hud-timer-item');

        this.taskModal = document.getElementById('task-modal');
        this.taskTitle = document.getElementById('task-title');
        this.taskDesc = document.getElementById('task-desc');
        this.taskAnswer = document.getElementById('task-answer');
        this.submitTaskBtn = document.getElementById(
            'submit-task-btn'
        );
        this.cancelTaskBtn = document.getElementById(
            'cancel-task-btn'
        );

        this.activeTask = null;

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

        document
            .getElementById('game-canvas')
            ?.addEventListener(
                'click',
                (event) => this.handleNodeClick(event)
            );
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

        this.lobbyView.showLobbyScreen();
        this.lobbyView.renderRoom(room);
    }

    onNetworkError(message) {
        this.lobbyView.showToast(
            'error',
            message
        );
    }

    handleCopyCode() {
        if (!this.room) {
            return;
        }

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
        this.network.leaveRoom();

        this.room = null;
        this.lobbyView.clearMapPreview();

        this.lobbyView.showEntryScreen();
        this.lobbyView.resetEntryForm();
    }

    handleStartGame() {
        this.network.startGame();
    }

    onGameStarted() {
        this.lobbyView.runStartCountdown(
            () => this.startGame()
        );
    }

    onGameState(gameState) {
        this.model.applyGameState(
            gameState.gameId,
            gameState.game
        );

        this.updateHud();

        this.view.render(
            Object.values(this.model.state.nodes)
        );
    }

    startGame() {
        const nickname = this.room
            ? this.room.you.name
            : 'Игрок';

        this.lobbyView.stopAmbientLoop();
        this.lobbyView.hideAll();

        this.gameScreen.classList.remove(
            'hidden'
        );

        this.playerName.textContent =
            nickname;

        this.updateHud();

        this.view.render(
            Object.values(this.model.state.nodes)
        );
    }

    updateHud() {
        const playerId = this.room?.you?.id;

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
        if (this.activeTask) {
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

        this.network.attackNode(nodeId);
    }

    onAttackStarted(message) {
        const task = message.task;

        this.activeTask = task;

        this.showTaskInputState();

        this.taskTitle.textContent =
            'Взлом узла';

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

        this.taskAnswer.focus();
    }

    submitTaskAnswer() {
        if (!this.activeTask) {
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

        this.showTaskResultState();

        this.taskAnswer.classList.remove(
            'input-error'
        );
        this.taskAnswer.value = '';

        if (this.cancelTaskBtn) {
            this.cancelTaskBtn.textContent =
                'Продолжить';
        }

        if (message.success) {
            this.taskTitle.textContent =
                'Узел успешно захвачен';

            this.taskDesc.textContent =
                message.explanation
                || 'Объяснение отсутствует.';

            this.taskModal.classList.remove(
                'hidden'
            );

            this.lobbyView.showToast(
                'success',
                `Узел захвачен! +${message.score_change} очков`
            );

            return;
        }

        this.taskTitle.textContent =
            'Попытка не удалась';

        this.taskDesc.textContent =
            message.theory
            || 'Теоретическая справка отсутствует.';

        this.taskAnswer.value = '';

        this.taskModal.classList.remove(
            'hidden'
        );
    }

    showTaskInputState() {
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

    showTaskResultState() {
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

    handleCancelTask() {
        if (this.activeTask) {
            this.network.cancelAttack(
                this.activeTask.id
            );
            return;
        }

        this.closeTaskModal();
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

        this.activeTask = null;
    }

}
