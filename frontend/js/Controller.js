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
}