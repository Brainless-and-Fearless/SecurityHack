export class Network {
    constructor(handlers, url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`) {
        this.handlers = handlers;
        this.url = url;
        this.ws = null;
        this.you = null;
        this.roomId = null;
    }

    _requestId() {
        return crypto.randomUUID();
    }

    _connect() {
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            this.ws = new WebSocket(this.url);
            this.ws.addEventListener('open', () => resolve(), { once: true });
            this.ws.addEventListener('error', () => reject(new Error('WS_CONNECTION_ERROR')), { once: true });
            this.ws.addEventListener('message', (event) => this._handleMessage(event));
            this.ws.addEventListener('close', () => {
                this.ws = null;
                this.handlers.onError && this.handlers.onError('Соединение с сервером потеряно');
            });
        });
    }

    _send(type, payload = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WS_NOT_CONNECTED');
        }
        this.ws.send(JSON.stringify({ type, ...payload }));
    }

    _roomToView(room) {
        const playerIds = room.player_ids || [];
        return {
            roomCode: room.id,
            players: playerIds.map((id) => ({
                id,
                name: id === this.you?.id ? (this.you.nickname || 'Вы') : id,
                isHost: id === room.host_id,
                status: 'online'
            })),
            you: this.you
                ? {
                    id: this.you.id,
                    name: this.you.nickname || 'Вы',
                    isHost: this.you.id === room.host_id,
                    status: 'online'
                }
                : null
        };
    }

    _handleMessage(event) {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch {
            return;
        }

        switch (data.type) {
            case 'ROOM_CREATED':
                this.roomId = data.room_id;
                this.you = {
                    id: data.player_id,
                    nickname: this.pendingNickname,
                    isHost: data.is_host
                };
                break;

            case 'ROOM_JOINED':
                this.roomId = data.room_id;
                this.you = {
                    id: data.player_id,
                    nickname: this.pendingNickname,
                    isHost: data.is_host
                };
                break;

            case 'ROOM_STATE': {
                const room = data.room;
                if (!room) return;
                this.roomId = room.id;
                this.handlers.onRoomState(this._roomToView(room));
                break;
            }

            case 'GAME_STARTED':
                this.handlers.onGameStarted && this.handlers.onGameStarted();
                break;

            case 'ERROR':
                this.handlers.onError && this.handlers.onError(data.message || 'Неизвестная ошибка сервера');
                break;

            default:
                break;
        }
    }

    async createRoom(nickname) {
        this.pendingNickname = nickname;
        try {
            await this._connect();
            this._send('CREATE_ROOM', {
                request_id: this._requestId(),
                nickname
            });
        } catch {
            this.handlers.onError && this.handlers.onError('Не удалось подключиться к серверу');
        }
    }

    async joinRoom(nickname, code) {
        this.pendingNickname = nickname;
        try {
            await this._connect();
            this._send('JOIN_ROOM', {
                request_id: this._requestId(),
                room_id: code.trim().toUpperCase(),
                nickname
            });
        } catch {
            this.handlers.onError && this.handlers.onError('Не удалось подключиться к серверу');
        }
    }

    leaveRoom() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.roomId = null;
        this.you = null;
    }

    startGame() {
        if (!this.ws || !this.roomId) return;
        this._send('START_GAME', {
            request_id: this._requestId()
        });
    }
}
