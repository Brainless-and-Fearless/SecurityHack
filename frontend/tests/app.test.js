import { describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    network: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        startGame: vi.fn(),
    },

    capturedLobbyTransport: {
        value: null,
    },

    capturedNetworkHandlers: {
        value: null,
    },

    onAttackCancelled: vi.fn(),
    onNodeUpgraded: vi.fn(),
    onGameFinished: vi.fn(),
}));

vi.mock('../js/Model.js', () => ({
    Model: class {
        constructor() {}
    },
}));

vi.mock('../js/View.js', () => ({
    View: class {
        constructor() {}
    },
}));

vi.mock('../js/LobbyView.js', () => ({
    LobbyView: class {
        constructor() {}
    },
}));

vi.mock('../js/Network.js', () => ({
    Network: class {
        constructor(handlers) {
            mocks.capturedNetworkHandlers.value =
                handlers;
            return mocks.network;
        }
    },
}));

vi.mock('../js/Controller.js', () => ({
    Controller: class {
        constructor(
            model,
            view,
            lobbyView,
            lobbyTransport,
        ) {
            mocks.capturedLobbyTransport.value =
                lobbyTransport;
        }

        onAttackCancelled(message) {
            mocks.onAttackCancelled(message);
        }

        onNodeUpgraded(message) {
            mocks.onNodeUpgraded(message);
        }

        onGameFinished(message) {
            mocks.onGameFinished(message);
        }
    },
}));


describe('app bootstrap', () => {
    test('creates Controller with real Network transport', async () => {
        vi.stubGlobal('document', {
            addEventListener: vi.fn(
                (event, callback) => {
                    if (event === 'DOMContentLoaded') {
                        callback();
                    }
                },
            ),
        });

        await import('../js/app.js');

        expect(
            mocks.capturedLobbyTransport.value
        ).toBe(mocks.network);

        vi.unstubAllGlobals();
    });

    test('routes ATTACK_CANCELLED from Network to Controller', async () => {
        vi.stubGlobal('document', {
            addEventListener: vi.fn(
                (event, callback) => {
                    if (event === 'DOMContentLoaded') {
                        callback();
                    }
                },
            ),
        });

        await import('../js/app.js');

        const message = {
            type: 'ATTACK_CANCELLED',
            request_id: 'req_cancel',
            task_id: 'task_123',
            node_id: 'node_7',
        };

        expect(
            mocks.capturedNetworkHandlers.value
                .onAttackCancelled
        ).toEqual(expect.any(Function));

        mocks.capturedNetworkHandlers.value
            .onAttackCancelled(message);

        expect(
            mocks.onAttackCancelled
        ).toHaveBeenCalledWith(message);

        vi.unstubAllGlobals();
    });


    test('routes NODE_UPGRADED from Network to Controller', async () => {
        vi.stubGlobal('document', {
            addEventListener: vi.fn(
                (event, callback) => {
                    if (event === 'DOMContentLoaded') {
                        callback();
                    }
                },
            ),
        });

        await import('../js/app.js');

        const message = {
            type: 'NODE_UPGRADED',
            request_id: 'req_upgrade',
            node_id: 'node_7',
            from_level: 'K1',
            to_level: 'K2',
            cost: 10,
        };

        expect(
            mocks.capturedNetworkHandlers.value
                .onNodeUpgraded
        ).toEqual(expect.any(Function));

        mocks.capturedNetworkHandlers.value
            .onNodeUpgraded(message);

        expect(
            mocks.onNodeUpgraded
        ).toHaveBeenCalledWith(message);

        vi.unstubAllGlobals();
    });


    test('routes GAME_FINISHED from Network to Controller', async () => {
        vi.stubGlobal('document', {
            addEventListener: vi.fn(
                (event, callback) => {
                    if (event === 'DOMContentLoaded') {
                        callback();
                    }
                },
            ),
        });

        await import('../js/app.js');

        const message = {
            type: 'GAME_FINISHED',
            game_id: 'game_1',
            winner_id: 'player_1',
            scores: {
                player_1: 15,
                player_2: 10,
            },
        };

        expect(
            mocks.capturedNetworkHandlers.value
                .onGameFinished
        ).toEqual(expect.any(Function));

        mocks.capturedNetworkHandlers.value
            .onGameFinished(message);

        expect(
            mocks.onGameFinished
        ).toHaveBeenCalledWith(message);

        vi.unstubAllGlobals();
    });
});
