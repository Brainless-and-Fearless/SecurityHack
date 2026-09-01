export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 5000];
export const RESUME_TIMEOUT_MS = 5000;

const SESSION_TOKEN_KEY = 'securityhack.sessionToken';

function createMemoryStorage() {
    const values = new Map();

    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
    };
}

export class Network {
    constructor(
        handlers,
        url = window.GAME_CONFIG?.websocketUrl,
        options = {},
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
        this.storage = options.storage ?? this._defaultStorage();
        this.sessionToken = this._readSessionToken();
        this.connectionState = 'disconnected';
        this.reconnectAttempt = 0;
        this.reconnectTimer = null;
        this.reconnectDelays = options.reconnectDelays
            ?? RECONNECT_DELAYS_MS;
        this.resumeTimeoutMs = options.resumeTimeoutMs
            ?? RESUME_TIMEOUT_MS;
        this.schedule = options.schedule ?? (
            (callback, delay) => globalThis.setTimeout(callback, delay)
        );
        this.cancelSchedule = options.cancelSchedule ?? (
            (timerId) => globalThis.clearTimeout(timerId)
        );
        this.resumeTimeout = null;
        this.resumePhase = null;
        this.pendingLeaveRequestId = null;
    }

    _defaultStorage() {
        try {
            if (window.sessionStorage) {
                return window.sessionStorage;
            }
        } catch {
            // Browser privacy settings may reject storage access.
        }

        return createMemoryStorage();
    }

    _readSessionToken() {
        try {
            return this.storage.getItem(SESSION_TOKEN_KEY);
        } catch {
            return null;
        }
    }

    _storeSessionToken(token) {
        this.sessionToken = token;

        try {
            this.storage.setItem(SESSION_TOKEN_KEY, token);
        } catch {
            // The in-memory credential still supports this page runtime.
        }
    }

    _clearSessionToken() {
        this.sessionToken = null;

        try {
            this.storage.removeItem(SESSION_TOKEN_KEY);
        } catch {
            // Storage is optional; the in-memory credential is gone.
        }
    }

    _setConnectionState(state) {
        if (this.connectionState === state) {
            return;
        }

        this.connectionState = state;
        this.handlers.onConnectionStateChange?.(state);
    }

    _requestId() {
        return crypto.randomUUID();
    }

    _connect({ resume = false } = {}) {
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            const socket = new WebSocket(this.url);
            this.ws = socket;

            socket.addEventListener('open', () => {
                if (this.ws !== socket) {
                    return;
                }

                if (!resume) {
                    this._setConnectionState('connected');
                }

                resolve();
            }, { once: true });
            socket.addEventListener(
                'error',
                () => reject(new Error('WS_CONNECTION_ERROR')),
                { once: true },
            );
            socket.addEventListener(
                'message',
                (event) => this._handleMessage(event),
            );
            socket.addEventListener('close', () => {
                if (this.ws !== socket) {
                    return;
                }

                this.ws = null;
                this._clearResumeHandshake();

                if (this.expectedCloseSockets.delete(socket)) {
                    return;
                }

                if (this.pendingLeaveRequestId !== null) {
                    this._completeLeave({
                        type: 'ROOM_LEFT',
                        request_id: this.pendingLeaveRequestId,
                        room_id: this.roomId,
                        local: true,
                    });
                    return;
                }

                if (this.sessionToken) {
                    this._setConnectionState('reconnecting');
                    this._scheduleReconnect();
                    return;
                }

                this._setConnectionState('disconnected');
                this.handlers.onError?.(
                    'Соединение с сервером потеряно'
                );
            });
        });
    }

    _scheduleReconnect() {
        if (this.reconnectTimer !== null || !this.sessionToken) {
            return;
        }

        const delayIndex = Math.min(
            this.reconnectAttempt,
            this.reconnectDelays.length - 1,
        );
        const delay = this.reconnectDelays[delayIndex];
        this.reconnectAttempt += 1;
        this.reconnectTimer = this.schedule(() => {
            this.reconnectTimer = null;
            void this._attemptResume();
        }, delay);
    }

    async _attemptResume() {
        if (!this.sessionToken) {
            return;
        }

        this._setConnectionState('reconnecting');

        try {
            await this._connect({ resume: true });
            const socket = this.ws;
            const requestId = this._requestId();

            this._send('RESUME_SESSION', {
                request_id: requestId,
                session_token: this.sessionToken,
            });
            this._startResumeHandshake(socket, requestId);
        } catch {
            this._scheduleReconnect();
        }
    }

    resumeStoredSession() {
        if (this.sessionToken) {
            void this._attemptResume();
        }
    }

    _cancelReconnect() {
        if (this.reconnectTimer !== null) {
            this.cancelSchedule(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    _startResumeHandshake(socket, requestId) {
        this._clearResumeHandshake();
        this.resumePhase = {
            socket,
            requestId,
            identityConfirmed: false,
            roomStateReceived: false,
            expectedGameId: undefined,
            gameStateReceived: false,
        };
        this.resumeTimeout = this.schedule(() => {
            this.resumeTimeout = null;

            if (
                !this.resumePhase
                || this.resumePhase.socket !== socket
            ) {
                return;
            }

            this.resumePhase = null;

            if (this.ws === socket) {
                this.ws = null;
                socket.close();
            }

            this._setConnectionState('reconnecting');
            this._scheduleReconnect();
        }, this.resumeTimeoutMs);
    }

    _cancelResumeTimeout() {
        if (this.resumeTimeout !== null) {
            this.cancelSchedule(this.resumeTimeout);
            this.resumeTimeout = null;
        }
    }

    _clearResumeHandshake() {
        this._cancelResumeTimeout();
        this.resumePhase = null;
    }

    _completeResumeIfReady() {
        const phase = this.resumePhase;

        if (
            !phase?.identityConfirmed
            || !phase.roomStateReceived
            || phase.expectedGameId === undefined
            || (
                phase.expectedGameId !== null
                && !phase.gameStateReceived
            )
        ) {
            return;
        }

        this._clearResumeHandshake();
        this._resetReconnect();
    }

    _resetReconnect() {
        this._cancelReconnect();
        this.reconnectAttempt = 0;
        this._setConnectionState('connected');
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
                name: id === this.you?.id
                    ? (this.you.nickname || 'Вы')
                    : id,
                isHost: id === room.host_id,
                status: 'online',
            })),
            you: this.you
                ? {
                    id: this.you.id,
                    name: this.you.nickname || 'Вы',
                    isHost: this.you.id === room.host_id,
                    status: 'online',
                }
                : null,
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
                    isHost: data.is_host,
                };
                this._storeSessionToken(data.session_token);
                this._resetReconnect();
                break;

            case 'ROOM_JOINED':
                this.roomId = data.room_id;
                this.you = {
                    id: data.player_id,
                    nickname: this.pendingNickname,
                    isHost: data.is_host,
                };
                this._storeSessionToken(data.session_token);
                this._resetReconnect();
                break;

            case 'SESSION_RESUMED':
                this.roomId = data.room_id;
                this.you = {
                    id: data.player_id,
                    nickname: this.you?.nickname,
                    isHost: data.is_host,
                };
                if (
                    this.resumePhase
                    && this.resumePhase.requestId === data.request_id
                ) {
                    this.resumePhase.identityConfirmed = true;
                    this.resumePhase.expectedGameId = data.game_id;
                }
                this.handlers.onSessionResumed?.(data);
                this._completeResumeIfReady();
                break;

            case 'ROOM_LEFT':
                if (
                    this.pendingLeaveRequestId === data.request_id
                ) {
                    this._completeLeave(data);
                }
                break;

            case 'ROOM_STATE':
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
                if (this.resumePhase) {
                    this.resumePhase.roomStateReceived = true;
                }
                this._completeResumeIfReady();
                break;

            case 'GAME_STARTED':
                this.handlers.onGameStarted?.();
                break;

            case 'GAME_STATE':
                this.handlers.onGameState?.({
                    gameId: data.game_id,
                    game: data.game,
                });
                if (
                    this.resumePhase
                    && this.resumePhase.expectedGameId === data.game_id
                ) {
                    this.resumePhase.gameStateReceived = true;
                }
                this._completeResumeIfReady();
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
                if (
                    this.pendingLeaveRequestId === data.request_id
                ) {
                    this.pendingLeaveRequestId = null;
                }
                if (data.code === 'INVALID_SESSION') {
                    this._clearSessionToken();
                    this._cancelReconnect();
                    this._clearResumeHandshake();
                    this._setConnectionState('disconnected');
                }
                this.handlers.onError?.(
                    data.message || 'Неизвестная ошибка сервера'
                );
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
                nickname,
            });
        } catch {
            this.handlers.onError?.(
                'Не удалось подключиться к серверу'
            );
        }
    }

    async joinRoom(nickname, code) {
        this.pendingNickname = nickname;
        try {
            await this._connect();
            this._send('JOIN_ROOM', {
                request_id: this._requestId(),
                room_id: code.trim().toUpperCase(),
                nickname,
            });
        } catch {
            this.handlers.onError?.(
                'Не удалось подключиться к серверу'
            );
        }
    }

    leaveRoom() {
        if (this.pendingLeaveRequestId !== null) {
            return;
        }

        if (
            this.ws
            && this.ws.readyState === WebSocket.OPEN
            && this.roomId
        ) {
            this.pendingLeaveRequestId = this._requestId();
            this._send('LEAVE_ROOM', {
                request_id: this.pendingLeaveRequestId,
            });
            return;
        }

        this._completeLeave({
            type: 'ROOM_LEFT',
            request_id: null,
            room_id: this.roomId,
            local: true,
        });
    }

    _completeLeave(message) {
        this._cancelReconnect();
        this._clearResumeHandshake();
        this._clearSessionToken();
        this.pendingLeaveRequestId = null;

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
        this.reconnectAttempt = 0;
        this._setConnectionState('disconnected');
        this.handlers.onRoomLeft?.(message);
    }

    startGame() {
        if (!this.ws || !this.roomId) return;
        this._send('START_GAME', {
            request_id: this._requestId(),
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
