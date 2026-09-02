import { afterEach, expect, test, vi } from 'vitest';
import { Controller } from '../js/Controller.js';


afterEach(() => {
    vi.unstubAllGlobals();
});


function classList(...initial) {
    const values = new Set(initial.filter(Boolean));
    return {
        add: vi.fn((name) => values.add(name)),
        remove: vi.fn((name) => values.delete(name)),
        toggle: vi.fn((name, force) => {
            if (force === true) values.add(name);
            else if (force === false) values.delete(name);
        }),
        contains: vi.fn((name) => values.has(name)),
    };
}


function eventElement(hidden = false) {
    const handlers = {};
    return {
        disabled: false,
        textContent: '',
        value: '',
        classList: classList(hidden ? 'hidden' : null),
        addEventListener: vi.fn((event, handler) => {
            handlers[event] = handler;
        }),
        click: vi.fn(() => handlers.click?.()),
        replaceChildren: vi.fn(),
    };
}


function createContext(connectionState = 'connected') {
    const ids = [
        'game-screen',
        'forfeit-game-btn',
        'forfeit-confirm-panel',
        'forfeit-stay-btn',
        'forfeit-confirm-btn',
        'task-modal',
        'task-title',
        'task-topic',
        'task-desc',
        'task-answer',
        'task-options',
        'submit-task-btn',
        'cancel-task-btn',
        'task-open-bestiary-btn',
        'node-upgrade-panel',
        'game-finished-panel',
        'player-name',
        'player-score',
        'player-resources',
        'game-timer',
        'hud-timer-item',
    ];
    const elements = Object.fromEntries(
        ids.map((id) => [id, eventElement([
            'forfeit-confirm-panel',
            'task-modal',
            'task-topic',
            'task-options',
            'task-open-bestiary-btn',
            'node-upgrade-panel',
            'game-finished-panel',
        ].includes(id))])
    );
    const model = {
        state: {
            gameId: 'game_1',
            status: 'running',
            players: {},
            nodes: {},
            tasks: {},
            remainingTimeSeconds: 300,
        },
        resetGame: vi.fn(),
    };
    const lobbyView = {
        modeCreateBtn: eventElement(),
        modeJoinBtn: eventElement(),
        entrySubmit: eventElement(),
        copyBtn: eventElement(),
        leaveBtn: eventElement(),
        startBtn: eventElement(),
        setEntryMode: vi.fn(),
        startAmbientLoop: vi.fn(),
        clearMapPreview: vi.fn(),
        showEntryScreen: vi.fn(),
        resetEntryForm: vi.fn(),
        showToast: vi.fn(),
    };
    const network = {
        connectionState,
        roomId: 'ROOM01',
        leaveRoom: vi.fn(),
    };
    const bestiaryView = {
        setHandlers: vi.fn(),
        hide: vi.fn(),
    };

    vi.stubGlobal('document', {
        addEventListener: vi.fn(),
        getElementById: vi.fn((id) => elements[id] ?? eventElement()),
    });

    const controller = new Controller(
        model,
        { render: vi.fn() },
        lobbyView,
        network,
        bestiaryView,
    );
    controller.room = { roomCode: 'ROOM01' };
    controller.audio.resetForNewMatch = vi.fn();

    return {
        controller,
        model,
        lobbyView,
        network,
        bestiaryView,
        elements,
        audio: controller.audio,
    };
}


test('Stay closes confirmation without sending leave', () => {
    const context = createContext();

    context.elements['forfeit-game-btn'].click();
    expect(
        context.elements['forfeit-confirm-panel'].classList.contains('hidden')
    ).toBe(false);

    context.elements['forfeit-stay-btn'].click();

    expect(context.network.leaveRoom).not.toHaveBeenCalled();
    expect(
        context.elements['forfeit-confirm-panel'].classList.contains('hidden')
    ).toBe(true);
});


test('confirmed forfeit sends exactly one authoritative leave request', () => {
    const context = createContext();
    context.elements['forfeit-game-btn'].click();

    context.elements['forfeit-confirm-btn'].click();
    context.elements['forfeit-confirm-btn'].click();

    expect(context.network.leaveRoom).toHaveBeenCalledTimes(1);
    expect(context.controller.forfeitPending).toBe(true);
    expect(context.elements['forfeit-confirm-btn'].disabled).toBe(true);
    expect(context.lobbyView.showEntryScreen).not.toHaveBeenCalled();
});


test.each(['disconnected', 'reconnecting'])(
    '%s state keeps match intact instead of forfeiting locally',
    (state) => {
        const context = createContext(state);
        context.elements['forfeit-game-btn'].click();

        context.elements['forfeit-confirm-btn'].click();

        expect(context.network.leaveRoom).not.toHaveBeenCalled();
        expect(context.model.resetGame).not.toHaveBeenCalled();
        expect(context.lobbyView.showEntryScreen).not.toHaveBeenCalled();
        expect(
            context.elements['forfeit-confirm-panel'].classList.contains('hidden')
        ).toBe(false);
        expect(context.controller.forfeitPending).toBe(false);
    },
);


test('ROOM_LEFT acknowledgement clears game UI and returns to entry', () => {
    const context = createContext();
    context.controller.activeTask = { id: 'task_1' };
    context.controller.taskResultEducation = {
        knowledge_module_id: 'data_encoding',
    };
    context.elements['task-modal'].classList.remove('hidden');
    context.elements['node-upgrade-panel'].classList.remove('hidden');
    context.elements['game-finished-panel'].classList.remove('hidden');

    context.controller.onRoomLeft({
        type: 'ROOM_LEFT',
        room_id: 'ROOM01',
    });

    expect(context.model.resetGame).toHaveBeenCalledTimes(1);
    expect(context.elements['game-screen'].classList.contains('hidden')).toBe(true);
    expect(context.elements['task-modal'].classList.contains('hidden')).toBe(true);
    expect(context.elements['node-upgrade-panel'].classList.contains('hidden')).toBe(true);
    expect(context.elements['game-finished-panel'].classList.contains('hidden')).toBe(true);
    expect(context.controller.activeTask).toBeNull();
    expect(context.controller.taskResultEducation).toBeNull();
    expect(context.bestiaryView.hide).toHaveBeenCalled();
    expect(context.audio.resetForNewMatch).toHaveBeenCalled();
    expect(context.lobbyView.showEntryScreen).toHaveBeenCalledTimes(1);
    expect(context.lobbyView.startAmbientLoop).toHaveBeenCalledTimes(2);
});
