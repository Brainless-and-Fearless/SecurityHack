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
        constructor() {
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
});