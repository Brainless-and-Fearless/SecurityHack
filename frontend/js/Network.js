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
        this.expectedCloseSockets = new WeakSet();
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

            const socket = new WebSocket(this.url);
            this.ws = socket;

            socket.addEventListener('open', () => resolve(), { once: true });
            socket.addEventListener('error', () => reject(new Error('WS_CONNECTION_ERROR')), { once: true });
            socket.addEventListener('message', (event) => this._handleMessage(event));
            socket.addEventListener('close', () => {
                if (this.ws === socket) {
                    this.ws = null;
                }

                if (this.expectedCloseSockets.delete(socket)) {
                    return;
                }

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

            case 'ATTACK_STARTED':
                this.handlers.onAttackStarted?.(data);
                break;

            case 'ATTACK_RESOLVED':
                this.handlers.onAttackResolved?.(data);
                break;

            case 'ATTACK_CANCELLED':
                this.handlers.onAttackCancelled?.(data);
                break;

            case 'NODE_UPGRADED':
                this.handlers.onNodeUpgraded?.(data);
                break;

            case 'GAME_FINISHED':
                this.handlers.onGameFinished?.(data);
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
            const socket = this.ws;

            this.expectedCloseSockets.add(socket);
            socket.close();

            if (this.ws === socket) {
                this.ws = null;
            }
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

    attackNode(nodeId) {
        this._send('ATTACK_NODE', {
            request_id: this._requestId(),
            node_id: nodeId,
        });
    }

    answerTask(taskId, answer) {
        this._send('ANSWER_TASK', {
            request_id: this._requestId(),
            task_id: taskId,
            answer,
        });
    }

    cancelAttack(taskId) {
        this._send('CANCEL_ATTACK', {
            request_id: this._requestId(),
            task_id: taskId,
        });
    }

    upgradeNode(nodeId) {
        this._send('UPGRADE_NODE', {
            request_id: this._requestId(),
            node_id: nodeId,
        });
    }
}
