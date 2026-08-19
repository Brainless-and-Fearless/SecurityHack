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
        this.timerId = null;
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
        this.playerScore.textContent = `Очки: ${score}`;
        this.playerResources.textContent = String(this.model.state.resources);
        this.gameTimer.textContent = this.formatTime(this.model.state.remainingTimeSeconds);
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
