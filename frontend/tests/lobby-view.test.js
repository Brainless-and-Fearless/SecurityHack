import { describe, expect, test, vi } from 'vitest';
import { LobbyView } from '../js/LobbyView.js';

describe('LobbyView map preview', () => {
    test('uses backend mapPreview instead of generating graph from players', () => {
        const ctx = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            createRadialGradient: vi.fn(() => ({
                addColorStop: vi.fn(),
            })),
        };
        
        
        const canvas = {
            width: 1000,
            height: 800,
            getContext: vi.fn(() => ctx),
        };

        const elements = {
            'screen-entry': { classList: { add: vi.fn(), remove: vi.fn() } },
            'nickname-input': { value: '' },
            'nickname-error': { textContent: '' },
            'mode-create': {
                classList: { toggle: vi.fn() },
                setAttribute: vi.fn(),
            },
            'mode-join': {
                classList: { toggle: vi.fn() },
                setAttribute: vi.fn(),
            },
            'entry-code-field': { classList: { toggle: vi.fn() } },
            'room-code-input': { value: '' },
            'room-code-error': { textContent: '' },
            'entry-submit': { textContent: '' },
            'entry-network-error': { textContent: '' },

            'screen-lobby': { classList: { add: vi.fn(), remove: vi.fn() } },
            'lobby-room-code': { textContent: '' },
            'player-list': { innerHTML: '', appendChild: vi.fn() },
            'player-count': {
                textContent: '',
                classList: { toggle: vi.fn() },
            },
            'start-game-btn': {
                classList: { add: vi.fn(), remove: vi.fn() },
                disabled: false,
            },
            'start-hint': {
                classList: { add: vi.fn(), remove: vi.fn() },
                textContent: '',
            },
            'waiting-host': {
                classList: { add: vi.fn(), remove: vi.fn() },
            },
            'copy-code-btn': {
                classList: { add: vi.fn(), remove: vi.fn() },
                textContent: '',
            },
            'leave-room-btn': {},
            'toast-stack': { appendChild: vi.fn() },
            'start-overlay': { classList: { add: vi.fn(), remove: vi.fn() } },
            'start-count': { textContent: '' },
            'bg-graph': canvas,
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => elements[id]),
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

        vi.stubGlobal('requestAnimationFrame', vi.fn());
        vi.stubGlobal('cancelAnimationFrame', vi.fn());

        const view = new LobbyView();

        view.renderRoom({
            roomCode: 'ABC234',

            you: {
                id: 'player_1',
                name: 'Alice',
                isHost: true,
            },

            // Намеренно только один игрок.
            players: [
                {
                    id: 'player_1',
                    name: 'Alice',
                    isHost: true,
                    status: 'online',
                },
            ],

            // Но backend уже прислал полноценную карту.
            mapPreview: {
                orbitCount: 3,

                nodes: [
                    {
                        id: 'n1_0',
                        orbit: 1,
                        x: 0.2,
                        y: 0.1,
                    },
                    {
                        id: 'n2_0',
                        orbit: 2,
                        x: 0.4,
                        y: 0.2,
                    },
                    {
                        id: 'n3_0',
                        orbit: 3,
                        x: 0.7,
                        y: -0.2,
                    },
                ],

                edges: [
                    ['n1_0', 'n2_0'],
                    ['n2_0', 'n3_0'],
                ],

                spawnNodes: ['n3_0'],
            },
        });

        expect(ctx.lineTo).toHaveBeenCalled();

        expect(ctx.arc).toHaveBeenCalledTimes(
            view._room.mapPreview.nodes.length
        );

        vi.unstubAllGlobals();
    });
});