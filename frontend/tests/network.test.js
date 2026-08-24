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