import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Controller } from '../js/Controller.js';


function element() {
    const listeners = {};
    return {
        textContent: '',
        value: '',
        disabled: false,
        offsetWidth: 0,
        classList: {
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn(),
        },
        addEventListener: vi.fn((type, listener) => {
            listeners[type] ??= [];
            listeners[type].push(listener);
        }),
        click() {
            for (const listener of listeners.click ?? []) {
                listener({ preventDefault: vi.fn() });
            }
        },
        replaceChildren: vi.fn(),
        focus: vi.fn(),
    };
}


function createController() {
    const elements = new Map();
    vi.stubGlobal('document', {
        addEventListener: vi.fn(),
        getElementById: vi.fn((id) => {
            if (!elements.has(id)) {
                elements.set(id, element());
            }
            return elements.get(id);
        }),
        createElement: vi.fn(() => element()),
    });

    const model = {
        state: {
            status: 'running',
            players: {
                player_1: {
                    nickname: 'Alice',
                    score: 10,
                    resources: 20,
                },
            },
            nodes: {},
            tasks: {},
            remainingTimeSeconds: 100,
        },
        applyGameState: vi.fn((gameId, game) => {
            model.state = {
                gameId,
                status: game.status,
                players: game.players,
                nodes: game.nodes,
                tasks: game.tasks,
                remainingTimeSeconds: game.remaining_time_seconds,
            };
        }),
    };
    const view = {
        render: vi.fn(),
    };
    const eventTarget = () => ({ addEventListener: vi.fn() });
    const lobbyView = {
        modeCreateBtn: eventTarget(),
        modeJoinBtn: eventTarget(),
        entrySubmit: eventTarget(),
        copyBtn: eventTarget(),
        leaveBtn: eventTarget(),
        startBtn: eventTarget(),
        setEntryMode: vi.fn(),
        startAmbientLoop: vi.fn(),
        stopAmbientLoop: vi.fn(),
        hideAll: vi.fn(),
        runStartCountdown: vi.fn(),
        showToast: vi.fn(),
        showEntryScreen: vi.fn(),
    };
    const network = {
        connectionState: 'connected',
        you: { id: 'player_1' },
        listKnowledge: vi.fn(),
        openKnowledge: vi.fn(),
        answerKnowledgeChallenge: vi.fn(),
    };
    const bestiaryView = {
        setHandlers: vi.fn(function (handlers) {
            this.handlers = handlers;
        }),
        renderCatalog: vi.fn(),
        renderLocked: vi.fn(),
        showChallengeFailure: vi.fn(),
        renderUnlocked: vi.fn(),
        renderOpened: vi.fn(),
        recoverChallengeSubmission: vi.fn(),
        showForEntry: vi.fn(),
        showForGame: vi.fn(),
        hide: vi.fn(),
    };

    const controller = new Controller(
        model,
        view,
        lobbyView,
        network,
        bestiaryView,
    );
    controller.room = {
        you: { id: 'player_1', name: 'Alice' },
    };

    return { controller, model, network, bestiaryView, elements, lobbyView };
}


describe('Controller Bestiary integration', () => {
    let context;

    beforeEach(() => {
        context = createController();
    });

    test('game lifecycle requests the authoritative catalog', () => {
        context.controller.startGame();

        expect(context.bestiaryView.showForGame).toHaveBeenCalledTimes(1);
        expect(context.network.listKnowledge).toHaveBeenCalledTimes(1);
    });

    test('entry menu opens the shared Bestiary and requests authoritative catalog', () => {
        context.network.connectionState = 'disconnected';

        context.elements.get('open-bestiary-btn').click();

        expect(context.bestiaryView.showForEntry).toHaveBeenCalledTimes(1);
        expect(context.network.listKnowledge).toHaveBeenCalledTimes(1);
    });

    test('entry Bestiary close returns to entry without replacing its view', () => {
        context.bestiaryView.handlers.onCloseRequested();

        expect(context.bestiaryView.hide).toHaveBeenCalledTimes(1);
        expect(context.lobbyView.showEntryScreen).toHaveBeenCalledTimes(1);
    });

    test('module click delegates its id to Network', () => {
        context.bestiaryView.handlers.onModuleSelected('modern_encryption');

        expect(context.network.openKnowledge)
            .toHaveBeenCalledWith('modern_encryption');
    });

    test('challenge submission delegates exactly one textual request', () => {
        const accepted = context.bestiaryView.handlers.onChallengeSubmit(
            'modern_encryption',
            'gate_xor_009',
            '0010',
        );

        expect(accepted).toBe(true);
        expect(context.network.answerKnowledgeChallenge).toHaveBeenCalledTimes(1);
        expect(context.network.answerKnowledgeChallenge).toHaveBeenCalledWith(
            'modern_encryption',
            'gate_xor_009',
            '0010',
        );
    });

    test.each([
        ['onKnowledgeCatalog', 'renderCatalog', { modules: [{ id: 'm1' }] }, 'modules'],
        ['onKnowledgeLocked', 'renderLocked', { module: { id: 'm1' }, challenge: { id: 'g1' } }, null],
        ['onKnowledgeChallengeFailed', 'showChallengeFailure', { module_id: 'm1', challenge_id: 'g1' }, null],
        ['onKnowledgeUnlocked', 'renderUnlocked', { module: { id: 'm1', content: 'text' } }, 'module'],
        ['onKnowledgeOpened', 'renderOpened', { module: { id: 'm1', content: 'text' } }, 'module'],
    ])('%s forwards authoritative response to BestiaryView', (
        controllerMethod,
        viewMethod,
        message,
        argumentField,
    ) => {
        context.controller[controllerMethod](message);

        expect(context.bestiaryView[viewMethod]).toHaveBeenCalledWith(
            argumentField ? message[argumentField] : message,
        );
    });

    test('GAME_FINISHED refreshes catalog from server', () => {
        context.controller.onGameFinished({
            type: 'GAME_FINISHED',
            winner_id: 'player_1',
            scores: { player_1: 10 },
        });

        expect(context.network.listKnowledge).toHaveBeenCalledTimes(1);
    });

    test('server ERROR releases a pending Bestiary challenge for retry', () => {
        context.controller.onNetworkError('Challenge mismatch.');

        expect(context.bestiaryView.recoverChallengeSubmission)
            .toHaveBeenCalledTimes(1);
        expect(context.controller.lobbyView.showToast)
            .toHaveBeenCalledWith('error', 'Challenge mismatch.');
    });

    test('resume preserves displayed state and refreshes after connection is ready', () => {
        context.controller.onSessionResumed();

        expect(context.bestiaryView.renderCatalog).not.toHaveBeenCalled();
        expect(context.network.listKnowledge).not.toHaveBeenCalled();

        context.controller.onConnectionStateChange('connected');

        expect(context.network.listKnowledge).toHaveBeenCalledTimes(1);
        expect(context.bestiaryView.renderCatalog).not.toHaveBeenCalled();
    });

    test.each(['reconnecting', 'disconnected'])(
        '%s state blocks Bestiary requests',
        (state) => {
            context.network.connectionState = state;

            expect(
                context.bestiaryView.handlers.onModuleSelected('m1')
            ).toBe(false);
            expect(
                context.bestiaryView.handlers.onChallengeSubmit('m1', 'g1', 'x')
            ).toBe(false);
            expect(context.network.openKnowledge).not.toHaveBeenCalled();
            expect(context.network.answerKnowledgeChallenge).not.toHaveBeenCalled();
        },
    );
});
