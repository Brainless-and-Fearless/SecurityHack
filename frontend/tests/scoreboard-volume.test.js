import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { readStyles } from './helpers/read-styles.js';
import { Controller } from '../js/Controller.js';
import { Model } from '../js/Model.js';
import { ScoreboardView } from '../js/ScoreboardView.js';

function element() {
    const classes = new Set();
    const listeners = {};
    return {
        children: [], textContent: '', value: '', dataset: {},
        classList: {
            add: (...names) => names.forEach((name) => classes.add(name)),
            remove: (...names) => names.forEach((name) => classes.delete(name)),
            contains: (name) => classes.has(name),
            toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
        },
        setAttribute: vi.fn(), focus: vi.fn(),
        addEventListener(type, handler) { listeners[type] = handler; },
        emit(type) { listeners[type]?.({ target: this }); },
        appendChild(child) { this.children.push(child); },
        replaceChildren(...children) { this.children = children; },
    };
}

let elements;
let controller;
let scoreboard;
let network;
beforeEach(() => {
    elements = new Map();
    vi.stubGlobal('document', {
        addEventListener: vi.fn(),
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, element());
            return elements.get(id);
        },
        createElement: () => element(),
    });
    vi.stubGlobal('localStorage', { getItem: () => '40', setItem: vi.fn() });
    scoreboard = new ScoreboardView();
    network = { you: { id: 'b' }, connectionState: 'connected', listKnowledge: vi.fn() };
    const lobby = Object.fromEntries(
        ['modeCreateBtn', 'modeJoinBtn', 'entrySubmit', 'copyBtn', 'leaveBtn', 'startBtn']
            .map((id) => [id, element()]),
    );
    Object.assign(lobby, {
        setEntryMode: vi.fn(), startAmbientLoop: vi.fn(), stopAmbientLoop: vi.fn(),
        hideAll: vi.fn(), showToast: vi.fn(), clearMapPreview: vi.fn(),
        showEntryScreen: vi.fn(), resetEntryForm: vi.fn(),
    });
    controller = new Controller(new Model(), { render: vi.fn() }, lobby, network, null, scoreboard);
    controller.room = { you: { name: 'Bob' } };
});
afterEach(() => vi.unstubAllGlobals());

const game = () => ({
    status: 'running', remaining_time_seconds: 100, tasks: {},
    players: {
        a: { id: 'a', nickname: '<b>Alice</b>', score: 5, owned_node_ids: ['wrong'] },
        b: { id: 'b', nickname: 'Bob', score: 10, owned_node_ids: [] },
        c: { id: 'c', nickname: 'Charlie', score: 10 },
    },
    nodes: { n1: { owner_id: 'b' }, n2: { owner_id: 'b' }, n3: { owner_id: 'a' }, n4: { owner_id: null } },
});
const rows = () => elements.get('scoreboard-body').children;
const rowValues = () => rows().map((row) => row.children.map((cell) => cell.textContent));

test('page provides two labeled volume controls and one constrained right-side scoreboard', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = readStyles();
    for (const mode of ['entry', 'game']) {
        expect(html).toContain(`for="${mode}-master-volume"`);
        expect(html).toMatch(new RegExp(`id="${mode}-master-volume"[^>]*type="range"[^>]*min="0"[^>]*max="100"`));
    }
    expect(html.match(/id="scoreboard-panel"/g)).toHaveLength(1);
    const panelRule = css.match(/\.scoreboard-panel\s*\{([^}]*)\}/s)?.[1];
    expect(panelRule).toMatch(/right:\s*24px/);
    expect(panelRule).toMatch(/top:\s*104px/);
    expect(panelRule).toMatch(/aspect-ratio:\s*3\s*\/\s*7/);
    expect(panelRule).toContain('max-height:');
    const headingRule = css.match(/\.scoreboard-header h2\s*\{([^}]*)\}/s)?.[1];
    expect(headingRule).toMatch(/padding-left:\s*16px/);
    expect(css).toMatch(/\.volume-control input\[type="range"\]\s*\{[^}]*accent-color:\s*var\(--cyan-color\)/s);
});

test('entry and game sliders initialize from AudioManager and synchronize in both directions', () => {
    const entry = elements.get('entry-master-volume');
    const inGame = elements.get('game-master-volume');
    const setVolume = vi.spyOn(controller.audio, 'setMasterVolume');
    expect(entry.value).toBe('40');
    expect(inGame.value).toBe('40');
    entry.value = '0';
    entry.emit('input');
    expect(setVolume).toHaveBeenLastCalledWith(0);
    expect(inGame.value).toBe('0');
    expect(controller.audio.music.muted).toBe(true);
    inGame.value = '100';
    inGame.emit('input');
    expect(setVolume).toHaveBeenLastCalledWith(100);
    expect(entry.value).toBe('100');
    expect(controller.audio.music.volume).toBe(0.24);
    expect(controller.audio.music.play).not.toHaveBeenCalled();
});

test('GAME_STATE renders stable score order, authoritative node counts and current player', () => {
    const state = game();
    const original = JSON.stringify(state);
    controller.onGameState({ gameId: 'match-a', game: state });
    expect(rowValues()).toEqual([['Bob', '10', '2'], ['Charlie', '10', '0'], ['<b>Alice</b>', '5', '1']]);
    expect(rows()[0].classList.contains('is-you')).toBe(true);
    expect(rows()[1].classList.contains('is-you')).toBe(false);
    expect(rows()[2].children[0].children).toEqual([]);
    expect(JSON.stringify(state)).toBe(original);

    const updated = game();
    updated.players.a.score = 15;
    updated.nodes.n2.owner_id = 'a';
    controller.onGameState({ gameId: 'match-a', game: updated });
    expect(rowValues()).toEqual([['<b>Alice</b>', '15', '2'], ['Bob', '10', '1'], ['Charlie', '10', '0']]);
});

test('collapse survives updates and resume; reopen reuses panel without requests', () => {
    controller.onGameState({ gameId: 'match-a', game: game() });
    const panel = elements.get('scoreboard-panel');
    const reopen = elements.get('scoreboard-open-btn');
    elements.get('scoreboard-close-btn').emit('click');
    expect(panel.classList.contains('hidden')).toBe(true);
    expect(reopen.classList.contains('hidden')).toBe(false);
    expect(reopen.setAttribute).toHaveBeenLastCalledWith('aria-expanded', 'false');
    controller.onSessionResumed();
    controller.onGameState({ gameId: 'match-a', game: game() });
    expect(panel.classList.contains('hidden')).toBe(true);
    reopen.emit('click');
    expect(elements.get('scoreboard-panel')).toBe(panel);
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(reopen.classList.contains('hidden')).toBe(true);
    expect(reopen.setAttribute).toHaveBeenLastCalledWith('aria-expanded', 'true');
    expect(network.listKnowledge).not.toHaveBeenCalled();
});

test('new match resets collapse and rows; leaving clears scoreboard state', () => {
    controller.onGameState({ gameId: 'match-a', game: game() });
    elements.get('scoreboard-close-btn').emit('click');
    const nextGame = game();
    nextGame.players = { c: { id: 'c', nickname: 'Charlie', score: 0 } };
    nextGame.nodes = {};
    controller.onGameState({ gameId: 'match-b', game: nextGame });
    expect(rowValues()).toEqual([['Charlie', '0', '0']]);
    expect(elements.get('scoreboard-panel').classList.contains('hidden')).toBe(false);
    controller.onRoomLeft();
    expect(rows()).toEqual([]);
    expect(elements.get('scoreboard-panel').classList.contains('hidden')).toBe(true);
    expect(elements.get('scoreboard-open-btn').classList.contains('hidden')).toBe(true);
});
