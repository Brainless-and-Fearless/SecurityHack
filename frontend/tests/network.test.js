import { describe, expect, test, vi } from 'vitest';
import { Network } from '../js/Network.js';

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
