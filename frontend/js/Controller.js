export class Controller {
    constructor(model, view, lobbyView, lobbyTransport) {
        this.model = model;
        this.view = view;
        this.lobbyView = lobbyView;
        this.lobbyTransport = lobbyTransport;

        // game-screen элементы — как в исходном Controller.js
        this.gameScreen = document.getElementById('game-screen');

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
            // CLIENT -> SERVER: JOIN_ROOM
            this.lobbyTransport.joinRoom(nickname, code);
        } else {
            // CLIENT -> SERVER: CREATE_ROOM
            this.lobbyTransport.createRoom(nickname);
        }
    }

    // Вызывается транспортом (моком или реальным Network.js) при ROOM_CREATED/ROOM_JOINED/ROOM_STATE
    onRoomState(room) {
        this.room = room;
        this.lobbyView.showLobbyScreen();
        this.lobbyView.renderRoom(room);
    }

    // Вызывается транспортом при ERROR
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
        this.lobbyTransport.leaveRoom();
        this.room = null;
        this.lobbyView.showEntryScreen();
        this.lobbyView.resetEntryForm();
    }

    handleStartGame() {
        // CLIENT -> SERVER: START_GAME (только у хоста кнопка видна)
        this.lobbyTransport.startGame();
    }

    // Вызывается транспортом при GAME_STARTED — синхронный старт для всех игроков
    onGameStarted() {
        this.lobbyView.runStartCountdown(() => this.startGame());
    }

    startGame() {
        const nickname = this.room ? this.room.you.name : 'Игрок';

        this.lobbyView.stopAmbientLoop();
        this.lobbyView.hideAll();
        this.gameScreen.classList.remove('hidden');

        console.log(`Агент ${nickname} успешно подключен к системе.`);

        // 1. Просим Мозг сгенерировать Ядро (Core Server)
        this.model.generateNodes();

        // 2. Просим Вид отрисовать узлы на холсте
        this.view.render(this.model.state.nodes);

        // 3. Запускаем игровую экономику (MockClient)
        if (this.network) {
            this.network.startSimulation();
        }
    }
}
