import { describe, expect, test, vi } from 'vitest';
import { Network } from '../js/Network.js';

function createSessionStorage(initial = {}) {
    const values = new Map(Object.entries(initial));

    return {
        getItem: vi.fn((key) => values.get(key) ?? null),
        setItem: vi.fn((key, value) => values.set(key, value)),
        removeItem: vi.fn((key) => values.delete(key)),
    };
}


test('default reconnect timers preserve the browser global receiver', () => {
    const setTimeoutHost = vi.fn(function (callback, delay) {
        if (this !== globalThis) {
            throw new TypeError('Illegal invocation');
        }

        expect(callback).toEqual(expect.any(Function));
        expect(delay).toBe(500);
        return 41;
    });
    const clearTimeoutHost = vi.fn(function (timerId) {
        if (this !== globalThis) {
            throw new TypeError('Illegal invocation');
        }

        expect(timerId).toBe(41);
    });

    vi.stubGlobal('setTimeout', setTimeoutHost);
    vi.stubGlobal('clearTimeout', clearTimeoutHost);

    try {
        const network = new Network(
            {},
            'ws://localhost/ws',
            {
                storage: createSessionStorage({
                    'securityhack.sessionToken': 'private-token',
                }),
            },
        );

        expect(() => network._scheduleReconnect()).not.toThrow();
        expect(network.reconnectTimer).toBe(41);
        expect(network.reconnectAttempt).toBe(1);

        expect(() => network._cancelReconnect()).not.toThrow();
        expect(network.reconnectTimer).toBeNull();
        expect(setTimeoutHost).toHaveBeenCalledTimes(1);
        expect(clearTimeoutHost).toHaveBeenCalledTimes(1);
    } finally {
        vi.unstubAllGlobals();
    }
});


test('injected reconnect scheduler keeps existing delay and cancel semantics', () => {
    const schedule = vi.fn(() => 'injected-timer');
    const cancelSchedule = vi.fn();
    const network = new Network(
        {},
        'ws://localhost/ws',
        {
            storage: createSessionStorage({
                'securityhack.sessionToken': 'private-token',
            }),
            schedule,
            cancelSchedule,
        },
    );

    network._scheduleReconnect();

    expect(schedule).toHaveBeenCalledWith(
        expect.any(Function),
        500,
    );
    expect(network.reconnectTimer).toBe('injected-timer');
    expect(network.reconnectAttempt).toBe(1);

    network._cancelReconnect();

    expect(cancelSchedule).toHaveBeenCalledWith('injected-timer');
    expect(network.reconnectTimer).toBeNull();
});

describe('Network', () => {
    test('forwards GAME_STATE to onGameState handler', () => {
        const onGameState = vi.fn();

        const network = new Network(
            {
                onGameState,
            },
            'ws://localhost/ws'
        );

        const gameStateMessage = {
            type: 'GAME_STATE',
            game_id: 'game_123',
            game: {
                status: 'running',
                remaining_time_seconds: 900,
                players: {},
                nodes: {},
                tasks: {},
            },
        };

        network._handleMessage({
            data: JSON.stringify(gameStateMessage),
        });

        expect(onGameState).toHaveBeenCalledTimes(1);

        expect(onGameState).toHaveBeenCalledWith({
            gameId: 'game_123',
            game: gameStateMessage.game,
        });
    });
});


test('uses websocket URL from runtime configuration', () => {
    vi.stubGlobal('window', {
        GAME_CONFIG: {
            websocketUrl: 'ws://configured.example/ws',
        },
    });

    const network = new Network({});

    expect(network.url).toBe(
        'ws://configured.example/ws'
    );

    vi.unstubAllGlobals();
});

test('attackNode sends ATTACK_NODE message', () => {
    const network = new Network(
        {},
        'ws://localhost/ws'
    );

    network.ws = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
    };

    network.roomId = 'ABC234';

    network.attackNode('node_7');

    expect(
        network.ws.send
    ).toHaveBeenCalledTimes(1);

    const sent = JSON.parse(
        network.ws.send.mock.calls[0][0]
    );

    expect(sent.type).toBe('ATTACK_NODE');
    expect(sent.node_id).toBe('node_7');
    expect(sent.request_id).toEqual(
        expect.any(String)
    );
});


test('answerTask sends ANSWER_TASK message', () => {
    const network = new Network(
        {},
        'ws://localhost/ws'
    );

    network.ws = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
    };

    network.roomId = 'ABC234';

    network.answerTask(
        'task_123',
        'answer'
    );

    expect(
        network.ws.send
    ).toHaveBeenCalledTimes(1);

    const sent = JSON.parse(
        network.ws.send.mock.calls[0][0]
    );

    expect(sent.type).toBe('ANSWER_TASK');
    expect(sent.task_id).toBe('task_123');
    expect(sent.answer).toBe('answer');
    expect(sent.request_id).toEqual(
        expect.any(String)
    );
});


test('cancelAttack sends CANCEL_ATTACK message', () => {
    const network = new Network(
        {},
        'ws://localhost/ws'
    );

    network.ws = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
    };

    network.cancelAttack('task_123');

    expect(
        network.ws.send
    ).toHaveBeenCalledTimes(1);

    const sent = JSON.parse(
        network.ws.send.mock.calls[0][0]
    );

    expect(sent).toEqual({
        type: 'CANCEL_ATTACK',
        request_id: expect.any(String),
        task_id: 'task_123',
    });
});


test('upgradeNode sends server-authoritative UPGRADE_NODE request', () => {
    const network = new Network(
        {},
        'ws://localhost/ws'
    );

    network.ws = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
    };

    network.upgradeNode('node_7');

    expect(network.ws.send).toHaveBeenCalledTimes(1);

    const sent = JSON.parse(
        network.ws.send.mock.calls[0][0]
    );

    expect(sent).toEqual({
        type: 'UPGRADE_NODE',
        request_id: expect.any(String),
        node_id: 'node_7',
    });
    expect(sent).not.toHaveProperty('cost');
    expect(sent).not.toHaveProperty('to_level');
    expect(sent).not.toHaveProperty('resources');
});


test('listKnowledge sends LIST_KNOWLEDGE request', () => {
    const network = new Network({}, 'ws://localhost/ws');
    network.ws = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
    };

    network.listKnowledge();

    expect(JSON.parse(network.ws.send.mock.calls[0][0])).toEqual({
        type: 'LIST_KNOWLEDGE',
        request_id: expect.any(String),
    });
});


test('listKnowledge opens the existing transport for entry free study', async () => {
    const sockets = [];
    class KnowledgeWebSocket {
        static OPEN = 1;

        constructor() {
            this.readyState = 0;
            this.listeners = {};
            this.send = vi.fn();
            sockets.push(this);
        }

        addEventListener(type, listener) {
            this.listeners[type] ??= [];
            this.listeners[type].push(listener);
        }

        emit(type) {
            for (const listener of this.listeners[type] ?? []) {
                listener({});
            }
        }
    }
    vi.stubGlobal('WebSocket', KnowledgeWebSocket);

    try {
        const network = new Network({}, 'ws://localhost/ws');
        const request = network.listKnowledge();

        expect(sockets).toHaveLength(1);
        sockets[0].readyState = KnowledgeWebSocket.OPEN;
        sockets[0].emit('open');
        await request;

        expect(JSON.parse(sockets[0].send.mock.calls[0][0])).toEqual({
            type: 'LIST_KNOWLEDGE',
            request_id: expect.any(String),
        });

        await network.listKnowledge();
        expect(sockets).toHaveLength(1);
        expect(sockets[0].send).toHaveBeenCalledTimes(2);
    } finally {
        vi.unstubAllGlobals();
    }
});


test('openKnowledge sends OPEN_KNOWLEDGE request', () => {
    const network = new Network({}, 'ws://localhost/ws');
    network.ws = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
    };

    network.openKnowledge('modern_encryption');

    expect(JSON.parse(network.ws.send.mock.calls[0][0])).toEqual({
        type: 'OPEN_KNOWLEDGE',
        request_id: expect.any(String),
        module_id: 'modern_encryption',
    });
});


test('answerKnowledgeChallenge sends visible textual answer', () => {
    const network = new Network({}, 'ws://localhost/ws');
    network.ws = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
    };

    network.answerKnowledgeChallenge(
        'modern_encryption',
        'gate_xor_009',
        '0010',
    );

    expect(JSON.parse(network.ws.send.mock.calls[0][0])).toEqual({
        type: 'ANSWER_KNOWLEDGE_CHALLENGE',
        request_id: expect.any(String),
        module_id: 'modern_encryption',
        challenge_id: 'gate_xor_009',
        answer: '0010',
    });
});


test.each([
    ['KNOWLEDGE_CATALOG', 'onKnowledgeCatalog'],
    ['KNOWLEDGE_OPENED', 'onKnowledgeOpened'],
    ['KNOWLEDGE_LOCKED', 'onKnowledgeLocked'],
    ['KNOWLEDGE_CHALLENGE_FAILED', 'onKnowledgeChallengeFailed'],
    ['KNOWLEDGE_UNLOCKED', 'onKnowledgeUnlocked'],
])('forwards %s to %s handler', (type, handlerName) => {
    const handler = vi.fn();
    const network = new Network(
        { [handlerName]: handler },
        'ws://localhost/ws',
    );
    const message = {
        type,
        request_id: 'req_knowledge',
        marker: type,
    };

    network._handleMessage({ data: JSON.stringify(message) });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(message);
});


test('forwards ATTACK_STARTED to onAttackStarted handler', () => {
    const onAttackStarted = vi.fn();

    const network = new Network(
        { onAttackStarted },
        'ws://localhost/ws'
    );

    const message = {
        type: 'ATTACK_STARTED',
        request_id: 'req_attack',
        node_id: 'node_7',
        task: {
            id: 'task_123',
            node_id: 'node_7',
            player_id: 'player_1',
            defence_level: 'K1',
            template_id: 'test_k1',
            question: 'Question',
        },
        education: {
            knowledge_module_id: 'modern_encryption',
            knowledge_module_title: 'Современное шифрование',
        },
    };

    network._handleMessage({
        data: JSON.stringify(message),
    });

    expect(
        onAttackStarted
    ).toHaveBeenCalledTimes(1);

    expect(
        onAttackStarted
    ).toHaveBeenCalledWith(message);
});


test('forwards ATTACK_RESOLVED to onAttackResolved handler', () => {
    const onAttackResolved = vi.fn();

    const network = new Network(
        { onAttackResolved },
        'ws://localhost/ws'
    );

    const message = {
        type: 'ATTACK_RESOLVED',
        request_id: 'req_answer',
        node_id: 'node_7',
        success: false,
        score_change: -3,
        theory: 'Теория задачи',
        explanation: null,
        education: {
            knowledge_module_id: 'modern_encryption',
            knowledge_module_title: 'Современное шифрование',
            explanation: 'Авторитетное объяснение',
        },
    };

    network._handleMessage({
        data: JSON.stringify(message),
    });

    expect(
        onAttackResolved
    ).toHaveBeenCalledTimes(1);

    expect(
        onAttackResolved
    ).toHaveBeenCalledWith(message);
});


test('forwards ATTACK_CANCELLED to onAttackCancelled handler', () => {
    const onAttackCancelled = vi.fn();

    const network = new Network(
        { onAttackCancelled },
        'ws://localhost/ws'
    );

    const message = {
        type: 'ATTACK_CANCELLED',
        request_id: 'req_cancel',
        task_id: 'task_123',
        node_id: 'node_7',
    };

    network._handleMessage({
        data: JSON.stringify(message),
    });

    expect(
        onAttackCancelled
    ).toHaveBeenCalledTimes(1);

    expect(
        onAttackCancelled
    ).toHaveBeenCalledWith(message);
});


test('forwards NODE_UPGRADED to onNodeUpgraded handler', () => {
    const onNodeUpgraded = vi.fn();
    const network = new Network(
        { onNodeUpgraded },
        'ws://localhost/ws'
    );
    const message = {
        type: 'NODE_UPGRADED',
        request_id: 'req_upgrade',
        node_id: 'node_7',
        from_level: 'K1',
        to_level: 'K2',
        cost: 10,
    };

    network._handleMessage({
        data: JSON.stringify(message),
    });

    expect(onNodeUpgraded).toHaveBeenCalledTimes(1);
    expect(onNodeUpgraded).toHaveBeenCalledWith(message);
});


test('forwards GAME_FINISHED to onGameFinished handler', () => {
    const onGameFinished = vi.fn();
    const network = new Network(
        { onGameFinished },
        'ws://localhost/ws'
    );
    const message = {
        type: 'GAME_FINISHED',
        game_id: 'game_1',
        winner_id: 'player_1',
        scores: {
            player_1: 15,
            player_2: 10,
        },
    };

    network._handleMessage({
        data: JSON.stringify(message),
    });

    expect(onGameFinished).toHaveBeenCalledTimes(1);
    expect(onGameFinished).toHaveBeenCalledWith(message);
});


function createConnectedNetwork(onError) {
    const sockets = [];

    class FakeWebSocket {
        static OPEN = 1;

        constructor() {
            this.readyState = 0;
            this.listeners = {};
            this.send = vi.fn();
            sockets.push(this);
        }

        addEventListener(type, listener) {
            this.listeners[type] ??= [];
            this.listeners[type].push(listener);
        }

        emit(type, event = {}) {
            for (const listener of this.listeners[type] ?? []) {
                listener(event);
            }
        }

        close() {
            this.readyState = 3;
        }
    }

    vi.stubGlobal('WebSocket', FakeWebSocket);

    const network = new Network(
        { onError },
        'ws://localhost/ws'
    );
    const connected = network._connect();
    const socket = sockets[0];

    socket.readyState = FakeWebSocket.OPEN;
    socket.emit('open');

    return {
        connected,
        network,
        socket,
    };
}


test('intentional leave does not report a lost connection', async () => {
    const onError = vi.fn();
    const {
        connected,
        network,
        socket,
    } = createConnectedNetwork(onError);

    await connected;

    network.roomId = 'ABC234';
    network.you = {
        id: 'player_1',
    };

    network.leaveRoom();
    const request = JSON.parse(socket.send.mock.calls[0][0]);
    network._handleMessage({
        data: JSON.stringify({
            type: 'ROOM_LEFT',
            request_id: request.request_id,
            room_id: 'ABC234',
        }),
    });
    socket.emit('close');

    expect(onError).not.toHaveBeenCalled();
    expect(network.ws).toBeNull();
    expect(network.roomId).toBeNull();
    expect(network.you).toBeNull();

    vi.unstubAllGlobals();
});


test('unexpected socket close still reports a lost connection', async () => {
    const onError = vi.fn();
    const {
        connected,
        network,
        socket,
    } = createConnectedNetwork(onError);

    await connected;

    socket.emit('close');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
        'Соединение с сервером потеряно'
    );
    expect(network.ws).toBeNull();

    vi.unstubAllGlobals();
});


test.each(['ROOM_CREATED', 'ROOM_JOINED'])(
    '%s stores private resume token in session storage',
    (type) => {
        const storage = createSessionStorage();
        const network = new Network(
            {},
            'ws://localhost/ws',
            { storage }
        );

        network._handleMessage({
            data: JSON.stringify({
                type,
                request_id: 'req_session',
                room_id: 'ABC234',
                player_id: 'player_1',
                is_host: type === 'ROOM_CREATED',
                session_token: 'private-token',
            }),
        });

        expect(network.sessionToken).toBe('private-token');
        expect(storage.setItem).toHaveBeenCalledWith(
            'securityhack.sessionToken',
            'private-token'
        );
    }
);


function createReconnectNetwork({
    token = 'private-token',
    handlers = {},
} = {}) {
    const sockets = [];
    const storage = createSessionStorage({
        'securityhack.sessionToken': token,
    });

    class ReconnectWebSocket {
        static OPEN = 1;

        constructor() {
            this.readyState = 0;
            this.listeners = {};
            this.send = vi.fn();
            sockets.push(this);
        }

        addEventListener(type, listener) {
            this.listeners[type] ??= [];
            this.listeners[type].push(listener);
        }

        emit(type, event = {}) {
            for (const listener of this.listeners[type] ?? []) {
                listener(event);
            }
        }

        close() {
            this.readyState = 3;
        }
    }

    vi.stubGlobal('WebSocket', ReconnectWebSocket);

    const network = new Network(
        handlers,
        'ws://localhost/ws',
        { storage }
    );

    return {
        network,
        sockets,
        storage,
        WebSocketClass: ReconnectWebSocket,
    };
}


test('unexpected close schedules one reconnect and resumes stored session', async () => {
    vi.useFakeTimers();
    const onConnectionStateChange = vi.fn();
    const {
        network,
        sockets,
        WebSocketClass,
    } = createReconnectNetwork({
        handlers: { onConnectionStateChange },
    });
    const connected = network._connect();
    const firstSocket = sockets[0];
    firstSocket.readyState = WebSocketClass.OPEN;
    firstSocket.emit('open');
    await connected;

    firstSocket.emit('close');
    firstSocket.emit('close');

    expect(network.connectionState).toBe('reconnecting');
    expect(vi.getTimerCount()).toBe(1);
    expect(onConnectionStateChange).toHaveBeenCalledWith(
        'reconnecting'
    );

    await vi.advanceTimersByTimeAsync(500);
    expect(sockets).toHaveLength(2);

    const resumedSocket = sockets[1];
    resumedSocket.readyState = WebSocketClass.OPEN;
    resumedSocket.emit('open');
    await Promise.resolve();

    expect(resumedSocket.send).toHaveBeenCalledTimes(1);
    const resumeRequest = JSON.parse(
        resumedSocket.send.mock.calls[0][0]
    );
    expect(resumeRequest).toEqual({
        type: 'RESUME_SESSION',
        request_id: expect.any(String),
        session_token: 'private-token',
    });

    network._handleMessage({
        data: JSON.stringify({
            type: 'SESSION_RESUMED',
            request_id: resumeRequest.request_id,
            player_id: 'player_1',
            room_id: 'ABC234',
            is_host: true,
            game_id: null,
        }),
    });

    expect(network.you).toEqual({
        id: 'player_1',
        nickname: undefined,
        isHost: true,
    });
    expect(network.roomId).toBe('ABC234');
    expect(network.connectionState).toBe('reconnecting');

    network._handleMessage({
        data: JSON.stringify({
            type: 'ROOM_STATE',
            roomCode: 'ABC234',
            players: [],
            you: {
                id: 'player_1',
                name: 'Alice',
                isHost: true,
            },
            mapPreview: null,
        }),
    });

    expect(network.connectionState).toBe('connected');
    expect(vi.getTimerCount()).toBe(0);

    network.leaveRoom();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});


test('resume timeout closes stalled socket and schedules another attempt', async () => {
    vi.useFakeTimers();
    const {
        network,
        sockets,
        storage,
        WebSocketClass,
    } = createReconnectNetwork();

    network.resumeStoredSession();
    const socket = sockets[0];
    socket.readyState = WebSocketClass.OPEN;
    socket.emit('open');
    await Promise.resolve();

    expect(JSON.parse(socket.send.mock.calls[0][0])).toMatchObject({
        type: 'RESUME_SESSION',
        session_token: 'private-token',
    });
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(5000);

    expect(socket.readyState).toBe(3);
    expect(network.sessionToken).toBe('private-token');
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(network.connectionState).toBe('reconnecting');
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(sockets).toHaveLength(2);

    network.leaveRoom();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});


test('running-game resume completes only after room and game snapshots', async () => {
    vi.useFakeTimers();
    const eventOrder = [];
    const {
        network,
        sockets,
        WebSocketClass,
    } = createReconnectNetwork({
        handlers: {
            onSessionResumed: () => eventOrder.push('session-resumed'),
            onGameState: () => eventOrder.push('game-state'),
            onConnectionStateChange: (state) => {
                if (state === 'connected') {
                    eventOrder.push('connected');
                }
            },
        },
    });

    network.resumeStoredSession();
    const socket = sockets[0];
    socket.readyState = WebSocketClass.OPEN;
    socket.emit('open');
    await Promise.resolve();
    network.reconnectAttempt = 3;
    const resumeRequest = JSON.parse(
        socket.send.mock.calls[0][0]
    );

    network._handleMessage({
        data: JSON.stringify({
            type: 'SESSION_RESUMED',
            request_id: resumeRequest.request_id,
            player_id: 'player_1',
            room_id: 'ABC234',
            is_host: true,
            game_id: 'game_1',
        }),
    });

    expect(network.connectionState).toBe('reconnecting');

    network._handleMessage({
        data: JSON.stringify({
            type: 'ROOM_STATE',
            roomCode: 'ABC234',
            players: [],
            you: {
                id: 'player_1',
                name: 'Alice',
                isHost: true,
            },
            mapPreview: null,
        }),
    });

    expect(network.connectionState).toBe('reconnecting');

    network._handleMessage({
        data: JSON.stringify({
            type: 'GAME_STATE',
            game_id: 'game_1',
            game: {
                status: 'running',
                players: {},
                nodes: {},
                tasks: {},
            },
        }),
    });

    expect(network.connectionState).toBe('connected');
    expect(eventOrder).toEqual([
        'session-resumed',
        'game-state',
        'connected',
    ]);
    expect(network.reconnectAttempt).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(10000);
    expect(sockets).toHaveLength(1);

    network.leaveRoom();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});


test('intentional leave during resume cancels the handshake timeout', async () => {
    vi.useFakeTimers();
    const {
        network,
        sockets,
        WebSocketClass,
    } = createReconnectNetwork();

    network.resumeStoredSession();
    const socket = sockets[0];
    socket.readyState = WebSocketClass.OPEN;
    socket.emit('open');
    await Promise.resolve();

    expect(vi.getTimerCount()).toBe(1);

    network.leaveRoom();

    expect(network.sessionToken).toBeNull();
    expect(network.connectionState).toBe('disconnected');
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(10000);
    expect(sockets).toHaveLength(1);

    vi.useRealTimers();
    vi.unstubAllGlobals();
});


test('intentional leave clears resume session and never reconnects', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const {
        network,
        sockets,
        storage,
        WebSocketClass,
    } = createReconnectNetwork({ handlers: { onError } });
    const connected = network._connect();
    const socket = sockets[0];
    socket.readyState = WebSocketClass.OPEN;
    socket.emit('open');
    await connected;
    network.roomId = 'ABC234';
    network.you = { id: 'player_1' };

    network.leaveRoom();
    const request = JSON.parse(socket.send.mock.calls[0][0]);
    network._handleMessage({
        data: JSON.stringify({
            type: 'ROOM_LEFT',
            request_id: request.request_id,
            room_id: 'ABC234',
        }),
    });
    socket.emit('close');
    await vi.runAllTimersAsync();

    expect(network.sessionToken).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(
        'securityhack.sessionToken'
    );
    expect(sockets).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();

    vi.useRealTimers();
    vi.unstubAllGlobals();
});


test('connected lobby leave waits for ROOM_LEFT before clearing session', async () => {
    const onRoomLeft = vi.fn();
    const {
        network,
        sockets,
        storage,
        WebSocketClass,
    } = createReconnectNetwork({ handlers: { onRoomLeft } });
    const connected = network._connect();
    const socket = sockets[0];
    socket.readyState = WebSocketClass.OPEN;
    socket.emit('open');
    await connected;
    network.roomId = 'ABC234';
    network.you = { id: 'player_1' };

    network.leaveRoom();

    const request = JSON.parse(socket.send.mock.calls[0][0]);
    expect(request).toEqual({
        type: 'LEAVE_ROOM',
        request_id: expect.any(String),
    });
    expect(network.sessionToken).toBe('private-token');
    expect(network.roomId).toBe('ABC234');
    expect(socket.readyState).toBe(WebSocketClass.OPEN);

    network._handleMessage({
        data: JSON.stringify({
            type: 'ROOM_LEFT',
            request_id: request.request_id,
            room_id: 'ABC234',
        }),
    });

    expect(storage.removeItem).toHaveBeenCalledWith(
        'securityhack.sessionToken'
    );
    expect(network.sessionToken).toBeNull();
    expect(network.roomId).toBeNull();
    expect(network.you).toBeNull();
    expect(network.ws).toBeNull();
    expect(socket.readyState).toBe(3);
    expect(onRoomLeft).toHaveBeenCalledWith(
        expect.objectContaining({ room_id: 'ABC234' })
    );

    vi.unstubAllGlobals();
});


test('leave error preserves session identity and current socket', async () => {
    const onError = vi.fn();
    const {
        network,
        sockets,
        storage,
        WebSocketClass,
    } = createReconnectNetwork({ handlers: { onError } });
    const connected = network._connect();
    const socket = sockets[0];
    socket.readyState = WebSocketClass.OPEN;
    socket.emit('open');
    await connected;
    network.roomId = 'ABC234';
    network.you = { id: 'player_1' };
    network.leaveRoom();
    const request = JSON.parse(socket.send.mock.calls[0][0]);

    network._handleMessage({
        data: JSON.stringify({
            type: 'ERROR',
            request_id: request.request_id,
            code: 'LEAVE_NOT_ALLOWED_AFTER_GAME_START',
            message: 'Leave is not allowed.',
        }),
    });

    expect(network.sessionToken).toBe('private-token');
    expect(network.roomId).toBe('ABC234');
    expect(network.you).toEqual({ id: 'player_1' });
    expect(network.ws).toBe(socket);
    expect(socket.readyState).toBe(WebSocketClass.OPEN);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Leave is not allowed.');

    network.leaveRoom();
    vi.unstubAllGlobals();
});


test('unavailable socket leave clears locally and cancels reconnect', async () => {
    vi.useFakeTimers();
    const onRoomLeft = vi.fn();
    const {
        network,
        sockets,
    } = createReconnectNetwork({ handlers: { onRoomLeft } });
    network.roomId = 'ABC234';
    network.you = { id: 'player_1' };
    network._scheduleReconnect();
    expect(vi.getTimerCount()).toBe(1);

    network.leaveRoom();

    expect(network.sessionToken).toBeNull();
    expect(network.roomId).toBeNull();
    expect(network.you).toBeNull();
    expect(network.connectionState).toBe('disconnected');
    expect(onRoomLeft).toHaveBeenCalledWith(
        expect.objectContaining({
            room_id: 'ABC234',
            local: true,
        })
    );
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(10000);
    expect(sockets).toHaveLength(0);

    vi.useRealTimers();
    vi.unstubAllGlobals();
});


test('ROOM_STATE forwards authoritative offline and online presence', () => {
    const onRoomState = vi.fn();
    const network = new Network(
        { onRoomState },
        'ws://localhost/ws'
    );
    const base = {
        type: 'ROOM_STATE',
        roomCode: 'ABC234',
        you: {
            id: 'player_1',
            name: 'Alice',
            isHost: true,
            status: 'online',
        },
        mapPreview: null,
    };

    network._handleMessage({
        data: JSON.stringify({
            ...base,
            players: [
                base.you,
                {
                    id: 'player_2',
                    name: 'Bob',
                    isHost: false,
                    status: 'offline',
                },
            ],
        }),
    });
    network._handleMessage({
        data: JSON.stringify({
            ...base,
            players: [
                base.you,
                {
                    id: 'player_2',
                    name: 'Bob',
                    isHost: false,
                    status: 'online',
                },
            ],
        }),
    });

    expect(onRoomState.mock.calls[0][0].players[1].status).toBe(
        'offline'
    );
    expect(onRoomState.mock.calls[1][0].players[1].status).toBe(
        'online'
    );
});
