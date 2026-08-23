import { describe, expect, test, vi } from 'vitest';
import { Controller } from '../js/Controller.js';

describe('Controller', () => {
    test('forwards GAME_STATE to Model', () => {
        const model = {
            state: {
                nodes: {},
            },
            applyGameState: vi.fn(),
        };

        const view = {
            render: vi.fn(),
        };

        const lobbyView = {
            modeCreateBtn: { addEventListener: vi.fn() },
            modeJoinBtn: { addEventListener: vi.fn() },
            entrySubmit: { addEventListener: vi.fn() },
            copyBtn: { addEventListener: vi.fn() },
            leaveBtn: { addEventListener: vi.fn() },
            startBtn: { addEventListener: vi.fn() },

            setEntryMode: vi.fn(),
            startAmbientLoop: vi.fn(),

            showLobbyScreen: vi.fn(),
            renderRoom: vi.fn(),
            showToast: vi.fn(),
            runStartCountdown: vi.fn(),
            stopAmbientLoop: vi.fn(),
            hideAll: vi.fn(),
        };

        const gameScreen = {
            classList: {
                remove: vi.fn(),
                add: vi.fn(),
            },
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'game-screen') {
                    return gameScreen;
                }

                return {
                    addEventListener: vi.fn(),
                    textContent: '',
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn(),
                    },
                };
            }),
        });

        const controller = new Controller(
            model,
            view,
            lobbyView,
            {},
        );

        controller.onGameState({
            gameId: 'game_123',
            game: {
                status: 'running',
                remaining_time_seconds: 900,
                players: {},
                nodes: {},
                tasks: {},
            },
        });

        expect(
            model.applyGameState
        ).toHaveBeenCalledTimes(1);

        expect(
            model.applyGameState
        ).toHaveBeenCalledWith(
            'game_123',
            {
                status: 'running',
                remaining_time_seconds: 900,
                players: {},
                nodes: {},
                tasks: {},
            },
        );

        vi.unstubAllGlobals();
    });
});

    test('renders nodes after receiving GAME_STATE', () => {
        const model = {
            applyGameState: vi.fn((gameId, game) => {
                model.state = {
                    gameId,
                    ...game,
                };
            }),
            state: {
                nodes: {},
            },
        };

        const view = {
            render: vi.fn(),
        };

        const lobbyView = {
            modeCreateBtn: { addEventListener: vi.fn() },
            modeJoinBtn: { addEventListener: vi.fn() },
            entrySubmit: { addEventListener: vi.fn() },
            copyBtn: { addEventListener: vi.fn() },
            leaveBtn: { addEventListener: vi.fn() },
            startBtn: { addEventListener: vi.fn() },

            setEntryMode: vi.fn(),
            startAmbientLoop: vi.fn(),

            showLobbyScreen: vi.fn(),
            renderRoom: vi.fn(),
            showToast: vi.fn(),
            runStartCountdown: vi.fn(),
            stopAmbientLoop: vi.fn(),
            hideAll: vi.fn(),
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                addEventListener: vi.fn(),
                textContent: '',
                classList: {
                    add: vi.fn(),
                    remove: vi.fn(),
                    toggle: vi.fn(),
                },
            })),
        });

        const controller = new Controller(
            model,
            view,
            lobbyView,
            {},
        );

        const nodes = {
            node_1: {
                id: 'node_1',
                owner_id: 'player_1',
                defence_level: 'K1',
                neighbor_ids: [],
                active_attack_player_id: null,
            },
        };

        controller.onGameState({
            gameId: 'game_123',
            game: {
                status: 'running',
                remaining_time_seconds: 900,
                players: {},
                nodes,
                tasks: {},
            },
        });

        expect(view.render).toHaveBeenCalledTimes(1);

        expect(view.render).toHaveBeenCalledWith(
            Object.values(nodes),
        );

        vi.unstubAllGlobals();
    });


        test('GAME_STARTED does not create a local mock game', () => {
            const model = {
                state: {
                    players: {},
                    nodes: {},
                },
                resetGame: vi.fn(),
                generateNodes: vi.fn(),
                applyGameState: vi.fn(),
            };

            const view = {
                render: vi.fn(),
            };

            const lobbyView = {
                modeCreateBtn: { addEventListener: vi.fn() },
                modeJoinBtn: { addEventListener: vi.fn() },
                entrySubmit: { addEventListener: vi.fn() },
                copyBtn: { addEventListener: vi.fn() },
                leaveBtn: { addEventListener: vi.fn() },
                startBtn: { addEventListener: vi.fn() },

                setEntryMode: vi.fn(),
                startAmbientLoop: vi.fn(),
                runStartCountdown: vi.fn(),
                stopAmbientLoop: vi.fn(),
                hideAll: vi.fn(),
            };

            vi.stubGlobal('document', {
                getElementById: vi.fn(() => ({
                    addEventListener: vi.fn(),
                    textContent: '',
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn(),
                    },
                })),
            });

            const controller = new Controller(
                model,
                view,
                lobbyView,
                {},
            );

            controller.startGame();

            expect(model.resetGame).not.toHaveBeenCalled();
            expect(model.generateNodes).not.toHaveBeenCalled();

            vi.unstubAllGlobals();
        });    


        test('uses network as the single transport', () => {
            const legacyTransport = {
                startGame: vi.fn(),
            };

            const network = {
                startGame: vi.fn(),
            };

            const model = {
                state: {
                    players: {},
                    nodes: {},
                },
                applyGameState: vi.fn(),
            };

            const view = {
                render: vi.fn(),
            };

            const lobbyView = {
                modeCreateBtn: { addEventListener: vi.fn() },
                modeJoinBtn: { addEventListener: vi.fn() },
                entrySubmit: { addEventListener: vi.fn() },
                copyBtn: { addEventListener: vi.fn() },
                leaveBtn: { addEventListener: vi.fn() },
                startBtn: { addEventListener: vi.fn() },

                setEntryMode: vi.fn(),
                startAmbientLoop: vi.fn(),
            };

            vi.stubGlobal('document', {
                getElementById: vi.fn(() => ({
                    addEventListener: vi.fn(),
                    textContent: '',
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn(),
                    },
                })),
            });

            const controller = new Controller(
                model,
                view,
                lobbyView,
                legacyTransport,
            );

            controller.network = network;

            controller.handleStartGame();

            expect(network.startGame).toHaveBeenCalledTimes(1);
            expect(legacyTransport.startGame).not.toHaveBeenCalled();

            vi.unstubAllGlobals();
        });


        test('updateHud reads current player and timer from backend state', () => {
            const model = {
                state: {
                    players: {
                        player_1: {
                            id: 'player_1',
                            nickname: 'Alice',
                            score: 25,
                            resources: 42,
                            owned_node_ids: [],
                        },
                    },
                    nodes: {},
                    remaining_time_seconds: 847,
                },
                applyGameState: vi.fn(),
            };

            const view = {
                render: vi.fn(),
            };

            const lobbyView = {
                modeCreateBtn: { addEventListener: vi.fn() },
                modeJoinBtn: { addEventListener: vi.fn() },
                entrySubmit: { addEventListener: vi.fn() },
                copyBtn: { addEventListener: vi.fn() },
                leaveBtn: { addEventListener: vi.fn() },
                startBtn: { addEventListener: vi.fn() },

                setEntryMode: vi.fn(),
                startAmbientLoop: vi.fn(),
            };

            const elements = {
                'game-screen': {
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn(),
                    },
                },
                'player-name': {
                    textContent: '',
                },
                'player-score': {
                    textContent: '',
                },
                'player-resources': {
                    textContent: '',
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                    },
                    addEventListener: vi.fn(),
                },
                'game-timer': {
                    textContent: '',
                },
                'hud-timer-item': {
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn(),
                    },
                },
            };

            vi.stubGlobal('document', {
                getElementById: vi.fn(
                    (id) =>
                        elements[id] ?? {
                            addEventListener: vi.fn(),
                            textContent: '',
                            classList: {
                                add: vi.fn(),
                                remove: vi.fn(),
                                toggle: vi.fn(),
                            },
                        }
                ),
            });

            const controller = new Controller(
                model,
                view,
                lobbyView,
                {
                    startGame: vi.fn(),
                },
            );

            controller.room = {
                you: {
                    id: 'player_1',
                    name: 'Alice',
                    isHost: true,
                },
            };

            controller.updateHud();

            expect(
                elements['player-score'].textContent
            ).toBe('Очки: 25');

            expect(
                elements['player-resources'].textContent
            ).toBe('42');

            expect(
                elements['game-timer'].textContent
            ).toBe('14:07');

            vi.unstubAllGlobals();
        });

        test('startGame does not start a local game timer', () => {
            const model = {
                state: {
                    players: {},
                    nodes: {},
                    remaining_time_seconds: 900,
                },
                applyGameState: vi.fn(),
            };

            const view = {
                render: vi.fn(),
            };

            const lobbyView = {
                modeCreateBtn: { addEventListener: vi.fn() },
                modeJoinBtn: { addEventListener: vi.fn() },
                entrySubmit: { addEventListener: vi.fn() },
                copyBtn: { addEventListener: vi.fn() },
                leaveBtn: { addEventListener: vi.fn() },
                startBtn: { addEventListener: vi.fn() },

                setEntryMode: vi.fn(),
                startAmbientLoop: vi.fn(),
                stopAmbientLoop: vi.fn(),
                hideAll: vi.fn(),
            };

            vi.stubGlobal('document', {
                getElementById: vi.fn(() => ({
                    addEventListener: vi.fn(),
                    textContent: '',
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn(),
                    },
                })),
            });

            const controller = new Controller(
                model,
                view,
                lobbyView,
                {
                    startGame: vi.fn(),
                    leaveRoom: vi.fn(),
                },
            );

            const setIntervalSpy = vi.spyOn(
                globalThis,
                'setInterval'
            );

            controller.startGame();

            expect(
                setIntervalSpy
            ).not.toHaveBeenCalled();

            setIntervalSpy.mockRestore();
            vi.unstubAllGlobals();
        });