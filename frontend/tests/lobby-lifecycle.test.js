import { afterEach, expect, test, vi } from 'vitest';
import { Controller } from '../js/Controller.js';
import { LobbyView } from '../js/LobbyView.js';


afterEach(() => {
    vi.unstubAllGlobals();
});


test('real LobbyView supports the complete leave and next-preview lifecycle', () => {
    const classList = () => ({
        add: vi.fn(),
        remove: vi.fn(),
        toggle: vi.fn(),
    });
    const ctx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
    };
    const canvas = {
        width: 1000,
        height: 800,
        getContext: vi.fn(() => ctx),
    };
    const elements = new Map();

    const element = (id) => {
        if (id === 'bg-graph') {
            return canvas;
        }

        if (!elements.has(id)) {
            elements.set(id, {
                value: '',
                textContent: '',
                innerHTML: '',
                disabled: false,
                classList: classList(),
                appendChild: vi.fn(),
                setAttribute: vi.fn(),
            });
        }

        return elements.get(id);
    };

    vi.stubGlobal('document', {
        getElementById: vi.fn(element),
        createElement: vi.fn(() => ({
            textContent: '',
            innerHTML: '',
            className: '',
        })),
    });
    vi.stubGlobal('window', {
        innerWidth: 1000,
        innerHeight: 800,
        matchMedia: vi.fn(() => ({
            matches: true,
        })),
        addEventListener: vi.fn(),
    });

    const lobbyView = new LobbyView();

    expect(lobbyView).toBeInstanceOf(LobbyView);
    expect(typeof lobbyView.clearMapPreview).toBe(
        'function'
    );

    lobbyView._room = {
        mapPreview: {
            nodes: [{
                id: 'old-node',
                x: 0.1,
                y: 0.2,
            }],
            edges: [],
            spawnNodes: [],
        },
    };
    lobbyView._drawMapPreview();

    const controllerContext = {
        network: {
            leaveRoom: vi.fn(),
        },
        room: {
            roomCode: 'OLD001',
        },
        lobbyView,
    };

    expect(() => {
        Controller.prototype.handleLeaveRoom.call(
            controllerContext
        );
    }).not.toThrow();

    expect(lobbyView._room).toBeNull();
    expect(ctx.clearRect).toHaveBeenLastCalledWith(
        0,
        0,
        1000,
        800,
    );

    lobbyView.renderRoom({
        roomCode: 'NEXT01',
        you: {
            id: 'player_2',
        },
        players: [],
        mapPreview: {
            nodes: [{
                id: 'new-node',
                x: -0.2,
                y: 0.3,
            }],
            edges: [],
            spawnNodes: ['new-node'],
        },
    });

    expect(lobbyView._room.roomCode).toBe('NEXT01');
    expect(ctx.arc).toHaveBeenCalledTimes(2);
});
