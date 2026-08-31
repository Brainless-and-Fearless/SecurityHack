import { describe, expect, test, vi } from 'vitest';
import { Controller } from '../js/Controller.js';
import { Network } from '../js/Network.js';

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
                    you: {
                        id: 'player_1',
                    },
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


function createTrackedClassList(...initialNames) {
    const names = new Set(initialNames);

    return {
        add: vi.fn((name) => names.add(name)),
        remove: vi.fn((name) => names.delete(name)),
        toggle: vi.fn(),
        contains: vi.fn((name) => names.has(name)),
    };
}


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
                node_3: {
                    id: 'node_3',
                    owner_id: null,
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
        showToast: vi.fn(),
    };

    const network = {
        you: {
            id: 'player_1',
            nickname: 'Alice',
            isHost: true,
        },
        attackNode: vi.fn(),
        upgradeNode: vi.fn(),
        answerTask: vi.fn(),
        cancelAttack: vi.fn(),
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

test('clicking an enemy node attacks without opening upgrade panel', () => {
    const elements = createUpgradeElements();
    const {
        controller,
        view,
        network,
    } = createAttackController(elements);

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
    expect(controller.selectedUpgradeNodeId).toBeNull();
    expect(
        elements['node-upgrade-panel'].classList.contains('hidden')
    ).toBe(true);
});


function createUpgradeElements() {
    return {
        'game-canvas': {
            addEventListener: vi.fn(),
        },
        'node-upgrade-panel': {
            classList: createTrackedClassList('hidden'),
        },
        'node-upgrade-title': {
            textContent: '',
        },
        'node-upgrade-details': {
            textContent: '',
        },
        'upgrade-node-btn': {
            textContent: '',
            disabled: false,
            addEventListener: vi.fn(),
            classList: createTrackedClassList(),
        },
        'close-node-upgrade-btn': {
            addEventListener: vi.fn(),
        },
    };
}


test('clicking an owned node opens upgrade action without attacking', () => {
    const elements = createUpgradeElements();
    const {
        controller,
        view,
        network,
    } = createAttackController(elements);

    view.getNodeAtPoint.mockReturnValue('node_1');

    controller.handleNodeClick({
        clientX: 100,
        clientY: 100,
    });

    expect(network.attackNode).not.toHaveBeenCalled();
    expect(controller.selectedUpgradeNodeId).toBe('node_1');
    expect(
        elements['node-upgrade-panel'].classList.contains('hidden')
    ).toBe(false);
    expect(elements['node-upgrade-title'].textContent).toContain('K1');
    expect(elements['node-upgrade-details'].textContent).toContain('K2');
    expect(elements['node-upgrade-details'].textContent).toContain('10');
});


test('Network player identity routes an owned node to upgrade flow', () => {
    const elements = createUpgradeElements();
    const {
        controller,
        view,
    } = createAttackController(elements);
    const network = new Network({}, 'ws://localhost/ws');
    network.attackNode = vi.fn();
    network.upgradeNode = vi.fn();
    network._handleMessage({
        data: JSON.stringify({
            type: 'ROOM_CREATED',
            request_id: 'req_create',
            room_id: 'ABC234',
            player_id: 'player_1',
            is_host: true,
        }),
    });
    controller.network = network;
    controller.room = {
        roomCode: 'ABC234',
        players: [],
        mapPreview: null,
    };
    view.getNodeAtPoint.mockReturnValue('node_1');

    controller.handleNodeClick({
        clientX: 100,
        clientY: 100,
    });

    expect(network.you.id).toBe('player_1');
    expect(network.attackNode).not.toHaveBeenCalled();
    expect(controller.selectedUpgradeNodeId).toBe('node_1');
    expect(
        elements['node-upgrade-panel'].classList.contains('hidden')
    ).toBe(false);
});


test('clicking a neutral node keeps the attack flow', () => {
    const elements = createUpgradeElements();
    const {
        controller,
        view,
        network,
    } = createAttackController(elements);
    view.getNodeAtPoint.mockReturnValue('node_3');

    controller.handleNodeClick({
        clientX: 100,
        clientY: 100,
    });

    expect(network.attackNode).toHaveBeenCalledWith('node_3');
    expect(controller.selectedUpgradeNodeId).toBeNull();
    expect(
        elements['node-upgrade-panel'].classList.contains('hidden')
    ).toBe(true);
});


test('upgrade button sends only the selected node through Network', () => {
    const elements = createUpgradeElements();
    const {
        controller,
        view,
        network,
    } = createAttackController(elements);

    view.getNodeAtPoint.mockReturnValue('node_1');
    controller.handleNodeClick({
        clientX: 100,
        clientY: 100,
    });

    const clickHandler = elements['upgrade-node-btn']
        .addEventListener.mock.calls
        .find(([event]) => event === 'click')[1];
    clickHandler();

    expect(network.upgradeNode).toHaveBeenCalledTimes(1);
    expect(network.upgradeNode).toHaveBeenCalledWith('node_1');
});


test('local resources do not gate an owned K1 or K2 upgrade request', () => {
    const elements = createUpgradeElements();
    const {
        controller,
        model,
        view,
        network,
    } = createAttackController(elements);
    model.state.players.player_1.resources = 0;
    model.state.nodes.node_1.defence_level = 'K2';
    view.getNodeAtPoint.mockReturnValue('node_1');

    controller.handleNodeClick({
        clientX: 100,
        clientY: 100,
    });

    expect(elements['node-upgrade-details'].textContent).toContain('20');
    expect(elements['upgrade-node-btn'].disabled).toBe(false);

    const clickHandler = elements['upgrade-node-btn']
        .addEventListener.mock.calls
        .find(([event]) => event === 'click')[1];
    clickHandler();

    expect(network.upgradeNode).toHaveBeenCalledTimes(1);
    expect(network.upgradeNode).toHaveBeenCalledWith('node_1');
});


test('K3 owned node shows max level and cannot request K4', () => {
    const elements = createUpgradeElements();
    const {
        controller,
        model,
        view,
        network,
    } = createAttackController(elements);
    model.state.nodes.node_1.defence_level = 'K3';
    view.getNodeAtPoint.mockReturnValue('node_1');

    controller.handleNodeClick({
        clientX: 100,
        clientY: 100,
    });

    expect(elements['node-upgrade-details'].textContent).toContain(
        'Максимальный'
    );
    expect(elements['upgrade-node-btn'].disabled).toBe(true);
    expect(
        elements['upgrade-node-btn'].classList.contains('hidden')
    ).toBe(true);

    const clickHandler = elements['upgrade-node-btn']
        .addEventListener.mock.calls
        .find(([event]) => event === 'click')[1];
    clickHandler();

    expect(network.upgradeNode).not.toHaveBeenCalled();
});


test('authoritative GAME_STATE refreshes upgrade level and resources', () => {
    const elements = createUpgradeElements();
    elements['player-resources'] = {
        textContent: '',
        offsetWidth: 0,
        classList: createTrackedClassList(),
        addEventListener: vi.fn(),
    };
    const {
        controller,
        model,
        view,
    } = createAttackController(elements);
    view.getNodeAtPoint.mockReturnValue('node_1');
    controller.handleNodeClick({ clientX: 100, clientY: 100 });

    const game = {
        status: 'running',
        players: {
            player_1: {
                id: 'player_1',
                nickname: 'Alice',
                score: 0,
                resources: 10,
                owned_node_ids: ['node_1'],
            },
        },
        nodes: {
            node_1: {
                id: 'node_1',
                owner_id: 'player_1',
                defence_level: 'K2',
                neighbor_ids: ['node_2'],
            },
        },
        tasks: {},
        remaining_time_seconds: 899,
    };
    model.applyGameState.mockImplementation((gameId, state) => {
        model.state.gameId = gameId;
        model.state.status = state.status;
        model.state.players = state.players;
        model.state.nodes = state.nodes;
        model.state.tasks = state.tasks;
        model.state.remainingTimeSeconds = state.remaining_time_seconds;
    });

    controller.onGameState({
        gameId: 'game_1',
        game,
    });

    expect(elements['player-resources'].textContent).toBe('10');
    expect(elements['node-upgrade-title'].textContent).toContain('K2');
    expect(elements['node-upgrade-details'].textContent).toContain('K3');
    expect(elements['node-upgrade-details'].textContent).toContain('20');
    expect(controller.selectedUpgradeNodeId).toBe('node_1');
    expect(
        elements['node-upgrade-panel'].classList.contains('hidden')
    ).toBe(false);
    expect(view.render).toHaveBeenLastCalledWith([
        expect.objectContaining({ defence_level: 'K2' }),
    ]);
});


test('authoritative ownership loss closes the selected upgrade panel', () => {
    const elements = createUpgradeElements();
    const {
        controller,
        model,
        view,
    } = createAttackController(elements);
    view.getNodeAtPoint.mockReturnValue('node_1');
    controller.handleNodeClick({ clientX: 100, clientY: 100 });
    model.applyGameState.mockImplementation((gameId, state) => {
        model.state.gameId = gameId;
        model.state.status = state.status;
        model.state.players = state.players;
        model.state.nodes = state.nodes;
        model.state.tasks = state.tasks;
        model.state.remainingTimeSeconds = state.remaining_time_seconds;
    });

    controller.onGameState({
        gameId: 'game_1',
        game: {
            status: 'running',
            players: model.state.players,
            nodes: {
                node_1: {
                    ...model.state.nodes.node_1,
                    owner_id: 'player_2',
                },
            },
            tasks: {},
            remaining_time_seconds: 899,
        },
    });

    expect(controller.selectedUpgradeNodeId).toBeNull();
    expect(
        elements['node-upgrade-panel'].classList.contains('hidden')
    ).toBe(true);
});

test('leaving a room clears its preview and allows the next preview', () => {
    const nextRoom = {
        roomCode: 'NEXT01',
        players: [],
        mapPreview: {
            nodes: [{ id: 'new-node' }],
            edges: [],
            spawnNodes: [],
        },
    };
    const lobbyView = {
        clearMapPreview: vi.fn(),
        showEntryScreen: vi.fn(),
        resetEntryForm: vi.fn(),
        showLobbyScreen: vi.fn(),
        renderRoom: vi.fn(),
    };
    const context = {
        network: {
            leaveRoom: vi.fn(),
        },
        room: {
            roomCode: 'OLD001',
        },
        lobbyView,
    };

    Controller.prototype.handleLeaveRoom.call(
        context
    );

    expect(context.network.leaveRoom).toHaveBeenCalledTimes(1);
    expect(lobbyView.clearMapPreview).toHaveBeenCalledTimes(1);
    expect(context.room).toBeNull();
    expect(lobbyView.showEntryScreen).toHaveBeenCalledTimes(1);

    Controller.prototype.onRoomState.call(
        context,
        nextRoom,
    );

    expect(lobbyView.renderRoom).toHaveBeenCalledWith(
        nextRoom
    );
});


test('does not send ATTACK_NODE while a task is active', () => {
    const {
        controller,
        view,
        network,
    } = createAttackController();

    controller.activeTask = {
        id: 'task_123',
        node_id: 'node_2',
    };

    view.getNodeAtPoint.mockReturnValue(
        'node_2'
    );

    controller.handleNodeClick({
        clientX: 100,
        clientY: 100,
    });

    expect(
        network.attackNode
    ).not.toHaveBeenCalled();
});

test('ATTACK_STARTED opens task modal with question', () => {
    const answerClassList = createTrackedClassList(
        'hidden'
    );
    const submitClassList = createTrackedClassList(
        'hidden'
    );
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
            disabled: true,
            classList: answerClassList,
        },
        'submit-task-btn': {
            addEventListener: vi.fn(),
            disabled: true,
            classList: submitClassList,
        },
        'cancel-task-btn': {
            addEventListener: vi.fn(),
            textContent: 'Continue',
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

    expect(
        answerClassList.contains('hidden')
    ).toBe(false);
    expect(
        submitClassList.contains('hidden')
    ).toBe(false);
    expect(elements['task-answer'].disabled).toBe(false);
    expect(elements['submit-task-btn'].disabled).toBe(false);
    expect(
        elements['cancel-task-btn'].textContent
    ).toBe('Прервать');
});


test('cancel button requests cancellation without clearing active task', () => {
    const cancelTaskBtn = {
        addEventListener: vi.fn(),
    };
    const taskModalClassList = createTrackedClassList();

    const {
        controller,
        network,
    } = createAttackController({
        'cancel-task-btn': cancelTaskBtn,
        'task-modal': {
            classList: taskModalClassList,
        },
        'task-answer': {
            value: '',
            classList: createTrackedClassList(),
        },
    });

    const task = {
        id: 'task_123',
    };
    controller.activeTask = task;

    const cancelClickHandler = (
        cancelTaskBtn.addEventListener.mock.calls
            .find(([event]) => event === 'click')[1]
    );

    cancelClickHandler();

    expect(
        network.cancelAttack
    ).toHaveBeenCalledWith('task_123');
    expect(controller.activeTask).toBe(task);
    expect(
        taskModalClassList.contains('hidden')
    ).toBe(false);
});


test('ATTACK_CANCELLED closes modal and clears matching active task', () => {
    const taskModalClassList = createTrackedClassList();

    const {
        controller,
    } = createAttackController({
        'task-modal': {
            classList: taskModalClassList,
        },
        'task-answer': {
            value: '',
            classList: createTrackedClassList(),
        },
    });

    controller.activeTask = {
        id: 'task_123',
    };

    controller.onAttackCancelled({
        type: 'ATTACK_CANCELLED',
        request_id: 'req_cancel',
        task_id: 'task_123',
        node_id: 'node_2',
    });

    expect(controller.activeTask).toBeNull();
    expect(
        taskModalClassList.contains('hidden')
    ).toBe(true);
});


test('cancel button closes an already resolved result locally', () => {
    const cancelTaskBtn = {
        addEventListener: vi.fn(),
    };
    const taskModalClassList = createTrackedClassList();

    const {
        controller,
        network,
    } = createAttackController({
        'cancel-task-btn': cancelTaskBtn,
        'task-modal': {
            classList: taskModalClassList,
        },
        'task-answer': {
            value: '',
            classList: createTrackedClassList(),
        },
    });

    controller.activeTask = null;

    const cancelClickHandler = (
        cancelTaskBtn.addEventListener.mock.calls
            .find(([event]) => event === 'click')[1]
    );

    cancelClickHandler();

    expect(
        network.cancelAttack
    ).not.toHaveBeenCalled();
    expect(
        taskModalClassList.contains('hidden')
    ).toBe(true);
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


test('successful attack keeps explanation readable in result modal', () => {
    const taskModalClassList = createTrackedClassList(
        'hidden'
    );
    const answerClassList = createTrackedClassList();
    const submitClassList = createTrackedClassList();
    const elements = {
        'task-modal': {
            classList: taskModalClassList,
        },
        'task-title': {
            textContent: '',
        },
        'task-desc': {
            textContent: '',
        },
        'task-answer': {
            value: 'old answer',
            disabled: false,
            classList: answerClassList,
        },
        'submit-task-btn': {
            addEventListener: vi.fn(),
            disabled: false,
            classList: submitClassList,
        },
        'cancel-task-btn': {
            addEventListener: vi.fn(),
            textContent: 'Прервать',
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
    };

    controller.onAttackResolved({
        type: 'ATTACK_RESOLVED',
        request_id: 'req_answer',
        node_id: 'node_2',
        success: true,
        score_change: 5,
        theory: null,
        explanation: 'AES protects data with a symmetric key.',
    });

    expect(controller.activeTask).toBeNull();
    expect(
        taskModalClassList.contains('hidden')
    ).toBe(false);
    expect(
        elements['task-title'].textContent
    ).toMatch(/captured|success|захвачен|успеш/i);
    expect(
        elements['task-desc'].textContent
    ).toContain(
        'AES protects data with a symmetric key.'
    );
    expect(
        answerClassList.contains('hidden')
    ).toBe(true);
    expect(
        submitClassList.contains('hidden')
    ).toBe(true);
    expect(
        elements['cancel-task-btn'].textContent
    ).toBe('Продолжить');

    controller.submitTaskAnswer();

    expect(
        network.answerTask
    ).not.toHaveBeenCalled();
});


test('failed attack displays task theory', () => {
    const taskModalClassList = createTrackedClassList(
        'hidden'
    );
    const answerClassList = createTrackedClassList();
    const submitClassList = createTrackedClassList();
    const elements = {
        'task-modal': {
            classList: taskModalClassList,
        },
        'task-title': {
            textContent: '',
        },
        'task-desc': {
            textContent: '',
        },
        'task-answer': {
            value: 'retry',
            disabled: false,
            classList: answerClassList,
        },
        'submit-task-btn': {
            addEventListener: vi.fn(),
            disabled: false,
            classList: submitClassList,
        },
        'cancel-task-btn': {
            addEventListener: vi.fn(),
            textContent: 'Прервать',
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
    };

    controller.onAttackResolved({
        type: 'ATTACK_RESOLVED',
        request_id: 'req_answer',
        node_id: 'node_2',
        success: false,
        score_change: -3,
        theory: 'Криптографическая теория',
        explanation: null,
    });

    expect(controller.activeTask).toBeNull();
    expect(
        taskModalClassList.contains('hidden')
    ).toBe(false);
    expect(
        answerClassList.contains('hidden')
    ).toBe(true);
    expect(
        submitClassList.contains('hidden')
    ).toBe(true);
    expect(
        elements['cancel-task-btn'].textContent
    ).toBe('Продолжить');

    controller.submitTaskAnswer();

    expect(
        network.answerTask
    ).not.toHaveBeenCalled();

    expect(
        elements['task-desc'].textContent
    ).toBe(
        'Криптографическая теория'
    );
});


test('next ATTACK_STARTED restores task input controls after result', () => {
    const answerClassList = createTrackedClassList();
    const submitClassList = createTrackedClassList();
    const elements = {
        'task-modal': {
            classList: createTrackedClassList(),
        },
        'task-title': {
            textContent: '',
        },
        'task-desc': {
            textContent: '',
        },
        'task-answer': {
            value: 'old answer',
            focus: vi.fn(),
            disabled: false,
            classList: answerClassList,
        },
        'submit-task-btn': {
            addEventListener: vi.fn(),
            disabled: false,
            classList: submitClassList,
        },
        'cancel-task-btn': {
            addEventListener: vi.fn(),
            textContent: 'Прервать',
        },
    };

    const {
        controller,
    } = createAttackController(
        elements
    );

    controller.activeTask = {
        id: 'task_123',
    };

    controller.onAttackResolved({
        type: 'ATTACK_RESOLVED',
        request_id: 'req_answer',
        node_id: 'node_2',
        success: true,
        score_change: 5,
        theory: null,
        explanation: 'Explanation for the completed task.',
    });

    expect(answerClassList.contains('hidden')).toBe(true);
    expect(submitClassList.contains('hidden')).toBe(true);

    controller.onAttackStarted({
        type: 'ATTACK_STARTED',
        request_id: 'req_next_attack',
        node_id: 'node_3',
        task: {
            id: 'task_456',
            node_id: 'node_3',
            player_id: 'player_1',
            defence_level: 'K1',
            template_id: 'test_k1_next',
            question: 'Next question?',
        },
    });

    expect(answerClassList.contains('hidden')).toBe(false);
    expect(submitClassList.contains('hidden')).toBe(false);
    expect(elements['task-answer'].disabled).toBe(false);
    expect(elements['submit-task-btn'].disabled).toBe(false);
    expect(
        elements['cancel-task-btn'].textContent
    ).toBe('Прервать');
});
