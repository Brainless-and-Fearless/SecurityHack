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
                    remainingTimeSeconds: 847,
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


test('handles the complete room-to-game flow', () => {
    const model = {
        state: {
            gameId: null,
            status: 'waiting',
            players: {},
            nodes: {},
            tasks: {},
            remainingTimeSeconds: 0,
        },

        applyGameState: vi.fn(
            (gameId, gameState) => {
                model.state.gameId = gameId;
                model.state.status = gameState.status;
                model.state.players = gameState.players;
                model.state.nodes = gameState.nodes;
                model.state.tasks = gameState.tasks;
                model.state.remainingTimeSeconds =
                    gameState.remaining_time_seconds;
            }
        ),
    };

    const view = {
        render: vi.fn(),
    };

    const lobbyView = {
        modeCreateBtn: {
            addEventListener: vi.fn(),
        },
        modeJoinBtn: {
            addEventListener: vi.fn(),
        },
        entrySubmit: {
            addEventListener: vi.fn(),
        },
        copyBtn: {
            addEventListener: vi.fn(),
        },
        leaveBtn: {
            addEventListener: vi.fn(),
        },
        startBtn: {
            addEventListener: vi.fn(),
        },

        setEntryMode: vi.fn(),
        startAmbientLoop: vi.fn(),
        stopAmbientLoop: vi.fn(),
        showLobbyScreen: vi.fn(),
        renderRoom: vi.fn(),
        runStartCountdown: vi.fn(),
        hideAll: vi.fn(),
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

    const network = {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        leaveRoom: vi.fn(),
        startGame: vi.fn(),
    };

    const controller = new Controller(
        model,
        view,
        lobbyView,
        network,
    );

    const room = {
        roomCode: 'ABC234',

        you: {
            id: 'player_1',
            name: 'Alice',
            isHost: true,
        },

        players: [
            {
                id: 'player_1',
                name: 'Alice',
                isHost: true,
                status: 'online',
            },
            {
                id: 'player_2',
                name: 'Bob',
                isHost: false,
                status: 'online',
            },
        ],

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
            ],
            edges: [
                ['n1_0', 'n2_0'],
            ],
            spawnNodes: [
                'n2_0',
            ],
        },
    };

    // 1. ROOM_STATE
    controller.onRoomState(room);

    expect(controller.room).toBe(room);
    expect(
        lobbyView.showLobbyScreen
    ).toHaveBeenCalledTimes(1);

    expect(
        lobbyView.renderRoom
    ).toHaveBeenCalledWith(room);

    // 2. GAME_STARTED
    controller.onGameStarted();

    expect(
        lobbyView.runStartCountdown
    ).toHaveBeenCalledTimes(1);

    // Проверяем callback countdown.
    const countdownCallback =
        lobbyView.runStartCountdown.mock.calls[0][0];

    countdownCallback();

    expect(
        elements['game-screen'].classList.remove
    ).toHaveBeenCalledWith('hidden');

    // 3. GAME_STATE
    const gameStateMessage = {
        gameId: 'game_123',

        game: {
            status: 'running',

            players: {
                player_1: {
                    id: 'player_1',
                    nickname: 'Alice',
                    score: 0,
                    resources: 20,
                    owned_node_ids: ['n2_0'],
                },

                player_2: {
                    id: 'player_2',
                    nickname: 'Bob',
                    score: 0,
                    resources: 20,
                    owned_node_ids: ['n1_0'],
                },
            },

            nodes: {
                n1_0: {
                    id: 'n1_0',
                    owner_id: 'player_2',
                    defence_level: 'K1',
                    neighbor_ids: ['n2_0'],
                    active_attack_player_id: null,
                },

                n2_0: {
                    id: 'n2_0',
                    owner_id: 'player_1',
                    defence_level: 'K1',
                    neighbor_ids: ['n1_0'],
                    active_attack_player_id: null,
                },
            },

            tasks: {},

            remaining_time_seconds: 900,
        },
    };

    controller.onGameState(gameStateMessage);

    expect(
        model.applyGameState
    ).toHaveBeenCalledWith(
        'game_123',
        gameStateMessage.game
    );

    expect(model.state.status).toBe('running');
    expect(
        model.state.remainingTimeSeconds
    ).toBe(900);

    expect(
        model.state.players.player_1.resources
    ).toBe(20);

    expect(
        view.render
    ).toHaveBeenCalledWith(
        Object.values(model.state.nodes)
    );

    vi.unstubAllGlobals();
});


function createAttackController(elements = {}) {
    const model = {
        state: {
            players: {
                player_1: {
                    id: 'player_1',
                    nickname: 'Alice',
                    score: 0,
                    resources: 20,
                    owned_node_ids: ['node_1'],
                },
            },
            nodes: {
                node_1: {
                    id: 'node_1',
                    owner_id: 'player_1',
                    defence_level: 'K1',
                    neighbor_ids: ['node_2'],
                },
                node_2: {
                    id: 'node_2',
                    owner_id: 'player_2',
                    defence_level: 'K1',
                    neighbor_ids: ['node_1'],
                },
            },
            tasks: {},
            remainingTimeSeconds: 900,
        },
        applyGameState: vi.fn(),
    };

    const view = {
        render: vi.fn(),
        getNodeAtPoint: vi.fn(),
    };

    const lobbyView = {
        modeCreateBtn: {
            addEventListener: vi.fn(),
        },
        modeJoinBtn: {
            addEventListener: vi.fn(),
        },
        entrySubmit: {
            addEventListener: vi.fn(),
        },
        copyBtn: {
            addEventListener: vi.fn(),
        },
        leaveBtn: {
            addEventListener: vi.fn(),
        },
        startBtn: {
            addEventListener: vi.fn(),
        },
        setEntryMode: vi.fn(),
        startAmbientLoop: vi.fn(),
    };

    const network = {
        attackNode: vi.fn(),
        answerTask: vi.fn(),
        startGame: vi.fn(),
    };

    vi.stubGlobal('document', {
        getElementById: vi.fn(
            (id) => (
                elements[id] ?? {
                    addEventListener: vi.fn(),
                    textContent: '',
                    value: '',
                    classList: {
                        add: vi.fn(),
                        remove: vi.fn(),
                        toggle: vi.fn(),
                    },
                }
            )
        ),
    });

    const controller = new Controller(
        model,
        view,
        lobbyView,
        network,
    );

    controller.room = {
        roomCode: 'ABC234',
        you: {
            id: 'player_1',
            name: 'Alice',
            isHost: true,
        },
    };

    return {
        controller,
        model,
        view,
        network,
        lobbyView,
        elements,
    };
}

test('clicking a node sends ATTACK_NODE through Network', () => {
    const canvas = {
        addEventListener: vi.fn(),
    };

    const {
        controller,
        view,
        network,
    } = createAttackController({
        'game-canvas': canvas,
    });

    view.getNodeAtPoint.mockReturnValue(
        'node_2'
    );

    controller.handleNodeClick({
        clientX: 100,
        clientY: 100,
    });

    expect(
        network.attackNode
    ).toHaveBeenCalledTimes(1);

    expect(
        network.attackNode
    ).toHaveBeenCalledWith('node_2');
});

test('ATTACK_STARTED opens task modal with question', () => {
    const elements = {
        'task-modal': {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn(),
            },
        },
        'task-title': {
            textContent: '',
        },
        'task-desc': {
            textContent: '',
        },
        'task-answer': {
            value: '',
            focus: vi.fn(),
        },
        'game-screen': {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn(),
            },
        },
    };

    const {
        controller,
    } = createAttackController(
        elements
    );

    const task = {
        id: 'task_123',
        node_id: 'node_2',
        player_id: 'player_1',
        defence_level: 'K1',
        template_id: 'test_k1',
        question: 'Какой ответ правильный?',
    };

    controller.onAttackStarted({
        type: 'ATTACK_STARTED',
        request_id: 'req_attack',
        node_id: 'node_2',
        task,
    });

    expect(
        elements['task-modal']
            .classList.remove
    ).toHaveBeenCalledWith(
        'hidden'
    );

    expect(
        elements['task-desc'].textContent
    ).toBe(
        'Какой ответ правильный?'
    );

    expect(
        elements['task-answer'].focus
    ).toHaveBeenCalled();
});


test('submitting task answer sends ANSWER_TASK', () => {
    const elements = {
        'task-modal': {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn(),
            },
        },
        'task-answer': {
            value: 'Paris',
            focus: vi.fn(),
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
            },
        },
    };

    const {
        controller,
        network,
    } = createAttackController(
        elements
    );

    controller.activeTask = {
        id: 'task_123',
        question: 'Столица Франции?',
    };

    controller.submitTaskAnswer();

    expect(
        network.answerTask
    ).toHaveBeenCalledTimes(1);

    expect(
        network.answerTask
    ).toHaveBeenCalledWith(
        'task_123',
        'Paris',
    );
});


test('failed attack displays task theory', () => {
    const elements = {
        'task-modal': {
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                toggle: vi.fn(),
            },
        },
        'task-title': {
            textContent: '',
        },
        'task-desc': {
            textContent: '',
        },
    };

    const {
        controller,
    } = createAttackController(
        elements
    );

    controller.onAttackResolved({
        type: 'ATTACK_RESOLVED',
        request_id: 'req_answer',
        node_id: 'node_2',
        success: false,
        score_change: -3,
        theory: 'Криптографическая теория',
        explanation: null,
    });

    expect(
        elements['task-desc'].textContent
    ).toBe(
        'Криптографическая теория'
    );
});