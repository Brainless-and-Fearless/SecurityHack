import { describe, expect, test, vi } from 'vitest';
import { View } from '../js/View.js';

describe('View', () => {
    test('maps K1, K2 and K3 defence levels to dot counts', () => {
        const view = Object.create(View.prototype);

        expect(view.getDefenceLevel({
            defence_level: 'K1',
        })).toBe(1);

        expect(view.getDefenceLevel({
            defence_level: 'K2',
        })).toBe(2);

        expect(view.getDefenceLevel({
            defence_level: 'K3',
        })).toBe(3);
    });
});


test('finds node at canvas coordinates', () => {
    const view = Object.create(View.prototype);

    view.canvas = {
        width: 800,
        height: 600,
        getBoundingClientRect: () => ({
            left: 0,
            top: 0,
        }),
    };

    const nodes = [
        {
            id: 'node_1',
            x: 100,
            y: 100,
        },
        {
            id: 'node_2',
            x: 300,
            y: 300,
        },
    ];

    expect(
        view.getNodeAtPoint(
            nodes,
            500,
            400,
        )
    ).toBe('node_1');
});


test('returns null when point is not near any node', () => {
    const view = Object.create(View.prototype);

    view.canvas = {
        width: 800,
        height: 600,
        getBoundingClientRect: () => ({
            left: 0,
            top: 0,
        }),
    };

    const nodes = [
        {
            id: 'node_1',
            x: 100,
            y: 100,
        },
    ];

    expect(
        view.getNodeAtPoint(
            nodes,
            50,
            50,
        )
    ).toBeNull();
});


test('scales normalized node coordinates to screen coordinates', () => {
    const view = Object.create(View.prototype);

    view.canvas = {
        width: 800,
        height: 600,
    };

    view.ctx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
    };

    view.getOwner = vi.fn(() => null);
    view.getDefenceLevel = vi.fn(() => 1);
    view.getOwnerColor = vi.fn(() => '#334155');
    view.drawDefenceDots = vi.fn();

    view.render([
        {
            id: 'node_1',
            x: 0.5,
            y: -0.5,
            owner_id: null,
            defence_level: 'K1',
            active_attack_player_id: null,
        },
    ]);

    const position =
        view._renderedNodePositions.get(
            'node_1'
        );

    expect(position.x).toBeCloseTo(
        400 + 0.5 * (600 * 0.42)
    );

    expect(position.y).toBeCloseTo(
        300 - 0.5 * (600 * 0.42)
    );
});


test('stale attack animation stops after render without active attack', () => {
    const scheduledFrames = [];

    const requestAnimationFrame = vi.fn(
        (callback) => {
            scheduledFrames.push(callback);
            return scheduledFrames.length;
        }
    );

    vi.stubGlobal(
        'requestAnimationFrame',
        requestAnimationFrame
    );

    const view = Object.create(View.prototype);

    view.canvas = {
        width: 800,
        height: 600,
    };

    view.ctx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
    };

    view.getOwner = vi.fn(() => null);
    view.getDefenceLevel = vi.fn(() => 1);
    view.getOwnerColor = vi.fn(() => '#334155');
    view.drawDefenceDots = vi.fn();

    view.render([
        {
            id: 'node_1',
            x: 0,
            y: 0,
            owner_id: null,
            defence_level: 'K1',
            active_attack_player_id: 'player_1',
        },
    ]);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    view.render([
        {
            id: 'node_1',
            x: 0,
            y: 0,
            owner_id: null,
            defence_level: 'K1',
            active_attack_player_id: null,
        },
    ]);

    scheduledFrames[0]();

    vi.unstubAllGlobals();

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
});
