// Реальный WebSocket-транспорт лобби.
//
// ВАЖНО: main.py на момент интеграции этого файла реализует только
// голое эхо (принимает текст, оборачивает в {type:"message", message}).
// Он ещё не понимает CREATE_ROOM / JOIN_ROOM / START_GAME и не шлёт
// ROOM_CREATED / ROOM_JOINED / ROOM_STATE / ERROR / GAME_STARTED.
// Поэтому этот класс подключать в app.js рано — используйте
// LobbyMockClient, пока backend не пройдёт "Этап 6: Lobby integration"
// из дорожной карты (CREATE_ROOM, JOIN_ROOM, ROOM_STATE, host, START_GAME).
//
// Интерфейс идентичен LobbyMockClient.js, чтобы замена была одной строкой:
//   createRoom(nickname) / joinRoom(nickname, code) / leaveRoom() / startGame()
//   handlers.onRoomState(room) / handlers.onError(message) / handlers.onGameStarted()

export class Network {
    constructor(handlers, url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`) {
        this.handlers = handlers;
        this.url = url;
        this.ws = null;
        this.you = null;
    }

    _connect() {
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }
            this.ws = new WebSocket(this.url);
            this.ws.addEventListener('open', () => resolve());
            this.ws.addEventListener('error', (e) => reject(e));
            this.ws.addEventListener('message', (event) => this._handleMessage(event));
            this.ws.addEventListener('close', () => {
                this.handlers.onError && this.handlers.onError('Соединение с сервером потеряно');
            });
        });
    }

    _send(type, payload) {
        this.ws.send(JSON.stringify({ type, ...payload }));
    }

    _handleMessage(event) {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (e) {
            return; // не наш формат (например, эхо-ответ текущего main.py)
        }
        switch (data.type) {
            case 'ROOM_CREATED':
            case 'ROOM_JOINED':
            case 'ROOM_STATE':
                this.you = data.you;
                this.handlers.onRoomState({
                    you: data.you,
                    roomCode: data.roomCode,
                    players: data.players
                });
                break;
            case 'GAME_STARTED':
                this.handlers.onGameStarted();
                break;
            case 'ERROR':
                this.handlers.onError(data.message || 'Неизвестная ошибка сервера');
                break;
            default:
                // неизвестный/несогласованный тип — игнорируем молча,
                // чтобы не падать на текущем echo-сервере
                break;
        }
    }

    async createRoom(nickname) {
        try {
            await this._connect();
            this._send('CREATE_ROOM', { name: nickname });
        } catch (e) {
            this.handlers.onError('Не удалось подключиться к серверу');
        }
    }

    async joinRoom(nickname, code) {
        try {
            await this._connect();
            this._send('JOIN_ROOM', { name: nickname, code });
        } catch (e) {
            this.handlers.onError('Не удалось подключиться к серверу');
        }
    }

    leaveRoom() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // LEAVE_ROOM не входит в согласованный контракт (см. отчёт,
            // раздел 9) — добавлен как необходимый для UX минимум.
            this._send('LEAVE_ROOM', {});
            this.ws.close();
        }
    }

    startGame() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._send('START_GAME', {});
        }
    }
}
