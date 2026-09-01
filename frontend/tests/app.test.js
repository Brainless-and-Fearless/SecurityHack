import { describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    network: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        startGame: vi.fn(),
        resumeStoredSession: vi.fn(),
    },

    capturedLobbyTransport: {
        value: null,
    },

    capturedNetworkHandlers: {
        value: null,
    },

    bestiaryView: {},
    capturedBestiaryView: {
        value: null,
    },

    onAttackCancelled: vi.fn(),
    onNodeUpgraded: vi.fn(),
    onGameFinished: vi.fn(),
    onConnectionStateChange: vi.fn(),
    onRoomLeft: vi.fn(),
    onKnowledgeCatalog: vi.fn(),
    onKnowledgeOpened: vi.fn(),
    onKnowledgeLocked: vi.fn(),
    onKnowledgeChallengeFailed: vi.fn(),
    onKnowledgeUnlocked: vi.fn(),
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

vi.mock('../js/BestiaryView.js', () => ({
    BestiaryView: class {
        constructor() {
            return mocks.bestiaryView;
        }
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
            bestiaryView,
        ) {
            mocks.capturedLobbyTransport.value =
                lobbyTransport;
            mocks.capturedBestiaryView.value = bestiaryView;
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

        onConnectionStateChange(state) {
            mocks.onConnectionStateChange(state);
        }

        onRoomLeft(message) {
            mocks.onRoomLeft(message);
        }

        onKnowledgeCatalog(message) {
            mocks.onKnowledgeCatalog(message);
        }

        onKnowledgeOpened(message) {
            mocks.onKnowledgeOpened(message);
        }

        onKnowledgeLocked(message) {
            mocks.onKnowledgeLocked(message);
        }

        onKnowledgeChallengeFailed(message) {
            mocks.onKnowledgeChallengeFailed(message);
        }

        onKnowledgeUnlocked(message) {
            mocks.onKnowledgeUnlocked(message);
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
        expect(mocks.capturedBestiaryView.value).toBe(mocks.bestiaryView);
        expect(
            mocks.network.resumeStoredSession
        ).toHaveBeenCalledTimes(1);

        vi.unstubAllGlobals();
    });

    test.each([
        ['KNOWLEDGE_CATALOG', 'onKnowledgeCatalog', 'onKnowledgeCatalog'],
        ['KNOWLEDGE_OPENED', 'onKnowledgeOpened', 'onKnowledgeOpened'],
        ['KNOWLEDGE_LOCKED', 'onKnowledgeLocked', 'onKnowledgeLocked'],
        [
            'KNOWLEDGE_CHALLENGE_FAILED',
            'onKnowledgeChallengeFailed',
            'onKnowledgeChallengeFailed',
        ],
        ['KNOWLEDGE_UNLOCKED', 'onKnowledgeUnlocked', 'onKnowledgeUnlocked'],
    ])('routes %s from Network to Controller', async (
        type,
        handlerName,
        controllerSpyName,
    ) => {
        vi.stubGlobal('document', {
            addEventListener: vi.fn((event, callback) => {
                if (event === 'DOMContentLoaded') callback();
            }),
        });
        await import('../js/app.js');
        const message = { type, request_id: 'req_knowledge' };

        mocks.capturedNetworkHandlers.value[handlerName](message);

        expect(mocks[controllerSpyName]).toHaveBeenCalledWith(message);
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


    test('routes connection state from Network to Controller', async () => {
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
            mocks.capturedNetworkHandlers.value
                .onConnectionStateChange
        ).toEqual(expect.any(Function));

        mocks.capturedNetworkHandlers.value
            .onConnectionStateChange('reconnecting');

        expect(
            mocks.onConnectionStateChange
        ).toHaveBeenCalledWith('reconnecting');

        vi.unstubAllGlobals();
    });

    test('routes ROOM_LEFT from Network to Controller', async () => {
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
            type: 'ROOM_LEFT',
            request_id: 'req_leave',
            room_id: 'ABC234',
        };

        expect(
            mocks.capturedNetworkHandlers.value.onRoomLeft
        ).toEqual(expect.any(Function));
        mocks.capturedNetworkHandlers.value.onRoomLeft(message);
        expect(mocks.onRoomLeft).toHaveBeenCalledWith(message);

        vi.unstubAllGlobals();
    });
});
