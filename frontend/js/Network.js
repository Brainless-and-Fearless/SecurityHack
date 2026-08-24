export class Network {
    constructor(
        handlers,
        url = window.GAME_CONFIG?.websocketUrl,
    ) {
        if (!url) {
            throw new Error('WS_URL_NOT_CONFIGURED');
        }

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
                this.roomId = data.roomCode;

                this.you = data.you
                    ? {
                        id: data.you.id,
                        nickname: data.you.name,
                        isHost: data.you.isHost,
                    }
                    : null;

                this.handlers.onRoomState?.({
                    roomCode: data.roomCode,
                    players: data.players,
                    you: data.you,
                    mapPreview: data.mapPreview,
                });

                break;
            }

            case 'GAME_STARTED':
                this.handlers.onGameStarted && this.handlers.onGameStarted();
                break;

            case 'GAME_STATE':
                this.handlers.onGameState?.({
                    gameId: data.game_id,
                    game: data.game
                });
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
