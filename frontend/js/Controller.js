export class Controller {
    constructor(model, view, lobbyView, lobbyTransport) {
        this.model = model;
        this.view = view;
        this.lobbyView = lobbyView;
        this.lobbyTransport = lobbyTransport;
        this.gameScreen = document.getElementById('game-screen');
        this.playerName = document.getElementById('player-name');
        this.playerScore = document.getElementById('player-score');
        this.playerResources = document.getElementById('player-resources');
        this.gameTimer = document.getElementById('game-timer');
        this.hudTimerItem = document.getElementById('hud-timer-item');
        this.timerId = null;
        this._prevResources = null;
        this._prevScore = null;
        this.initEvents();
    }

    initEvents() {
        const lv = this.lobbyView;

        lv.modeCreateBtn.addEventListener('click', () => lv.setEntryMode('create'));
        lv.modeJoinBtn.addEventListener('click', () => lv.setEntryMode('join'));
        lv.entrySubmit.addEventListener('click', () => this.handleEntrySubmit());
        lv.copyBtn.addEventListener('click', () => this.handleCopyCode());
        lv.leaveBtn.addEventListener('click', () => this.handleLeaveRoom());
        lv.startBtn.addEventListener('click', () => this.handleStartGame());

        lv.setEntryMode('create');
        lv.startAmbientLoop();
    }

    handleEntrySubmit() {
        const lv = this.lobbyView;
        lv.clearEntryErrors();

        const nickname = lv.nicknameInput.value.trim();
        if (!nickname) {
            lv.showEntryFieldError('nickname', 'Введите никнейм, чтобы продолжить');
            return;
        }

        if (lv.entryMode === 'join') {
            const code = lv.roomCodeInput.value.trim().toUpperCase();
            if (!code) {
                lv.showEntryFieldError('roomCode', 'Введите код комнаты');
                return;
            }
            this.lobbyTransport.joinRoom(nickname, code);
        } else {
            this.lobbyTransport.createRoom(nickname);
        }
    }

    onRoomState(room) {
        this.room = room;
        this.lobbyView.showLobbyScreen();
        this.lobbyView.renderRoom(room);
    }

    onNetworkError(message) {
        this.lobbyView.showToast('error', message);
    }

    handleCopyCode() {
        if (!this.room) return;
        navigator.clipboard?.writeText(this.room.roomCode).catch(() => {});
        this.lobbyView.flashCopied();
        this.lobbyView.showToast('info', 'Код комнаты скопирован');
    }

    handleLeaveRoom() {
        this.stopGameTimer();
        this.lobbyTransport.leaveRoom();
        this.room = null;
        this.lobbyView.showEntryScreen();
        this.lobbyView.resetEntryForm();
    }

    handleStartGame() {
        this.lobbyTransport.startGame();
    }

    onGameStarted() {
        this.lobbyView.runStartCountdown(() => this.startGame());
    }

    startGame() {
        const nickname = this.room ? this.room.you.name : 'Игрок';

        this.lobbyView.stopAmbientLoop();
        this.lobbyView.hideAll();
        this.gameScreen.classList.remove('hidden');

        this.model.resetGame();
        this.model.state.players[nickname] = 0;
        this.model.generateNodes();

        this.playerName.textContent = nickname;
        this.updateHud();
        this.startGameTimer();
        this.view.render(this.model.state.nodes);

        if (this.network) {
            this.network.startSimulation();
        }
    }

    updateHud() {
        const nickname = this.room ? this.room.you.name : 'Игрок';
        const score = this.model.state.players[nickname] ?? 0;
        const resources = this.model.state.resources;
        const remaining = this.model.state.remainingTimeSeconds;

        this.playerScore.textContent = `Очки: ${score}`;
        this._flashChange(this.playerResources, this._prevResources, resources);
        this.playerResources.textContent = String(resources);
        this.gameTimer.textContent = this.formatTime(remaining);

        this._prevResources = resources;
        this._prevScore = score;

        if (this.hudTimerItem) {
            this.hudTimerItem.classList.toggle('is-critical', remaining <= 60);
            this.hudTimerItem.classList.toggle('is-warn', remaining > 60 && remaining <= 180);
        }
    }

    _flashChange(el, prevValue, nextValue) {
        if (prevValue === null || nextValue === prevValue) return;
        const cls = nextValue > prevValue ? 'bump-up' : 'bump-down';
        el.classList.remove('bump-up', 'bump-down');
        // Форсируем перезапуск анимации
        void el.offsetWidth;
        el.classList.add(cls);
        el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
    }

    formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    startGameTimer() {
        this.stopGameTimer();
        this.timerId = setInterval(() => {
            if (this.model.state.remainingTimeSeconds <= 0) {
                this.model.state.remainingTimeSeconds = 0;
                this.updateHud();
                this.stopGameTimer();
                return;
            }

            this.model.state.remainingTimeSeconds -= 1;
            this.updateHud();
        }, 1000);
    }

    stopGameTimer() {
        if (this.timerId !== null) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }
}
