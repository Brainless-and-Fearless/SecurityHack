import { describe, expect, test, vi } from 'vitest';
import { View } from '../js/View.js';


function createRenderView(operations = []) {
    const view = Object.create(View.prototype);

    view.canvas = {
        width: 800,
        height: 600,
    };
    view.ctx = {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(() => operations.push('edge')),
        lineTo: vi.fn(),
        arc: vi.fn(() => operations.push('node')),
        fill: vi.fn(),
        stroke: vi.fn(),
    };
    view.getOwner = vi.fn(() => null);
    view.getDefenceLevel = vi.fn(() => 1);
    view.getOwnerColor = vi.fn(() => '#334155');
    view.drawDefenceDots = vi.fn();

    return view;
}


function createConnectedNodes(activeAttackPlayerId = null) {
    return [
        {
            id: 'node_a',
            x: -0.5,
            y: 0,
            neighbor_ids: ['node_b'],
            active_attack_player_id: activeAttackPlayerId,
        },
        {
            id: 'node_b',
            x: 0.5,
            y: 0,
            neighbor_ids: ['node_a'],
            active_attack_player_id: null,
        },
    ];
}

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


test('draws graph edges on the first render', () => {
    const view = createRenderView();

    view.render(createConnectedNodes());

    expect(view.ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(view.ctx.lineTo).toHaveBeenCalledTimes(1);
});


test('first edge render does not require cached node positions', () => {
    const view = createRenderView();

    expect(view._renderedNodePositions).toBeUndefined();

    view.render(createConnectedNodes());

    expect(view.ctx.moveTo).toHaveBeenCalledTimes(1);
});


test('draws a bidirectional adjacency edge only once', () => {
    const view = createRenderView();

    view.render(createConnectedNodes());

    expect(view.ctx.lineTo).toHaveBeenCalledTimes(1);
});


test('draws nodes after graph edges', () => {
    const operations = [];
    const view = createRenderView(operations);

    view.render(createConnectedNodes());

    expect(operations[0]).toBe('edge');
    expect(operations.slice(1)).toEqual(['node', 'node']);
});


test('draws the same edge set on consecutive renders', () => {
    const view = createRenderView();
    const nodes = createConnectedNodes();

    view.render(nodes);
    expect(view.ctx.lineTo).toHaveBeenCalledTimes(1);

    view.render(nodes);
    expect(view.ctx.lineTo).toHaveBeenCalledTimes(2);
});


test('skips an edge whose neighbor node is missing', () => {
    const view = createRenderView();
    const nodes = [{
        id: 'node_a',
        x: 0,
        y: 0,
        neighbor_ids: ['missing_node'],
        active_attack_player_id: null,
    }];

    expect(() => view.render(nodes)).not.toThrow();
    expect(view.ctx.moveTo).not.toHaveBeenCalled();
});


test('attack animation render keeps graph edges visible', () => {
    const scheduledFrames = [];
    vi.stubGlobal(
        'requestAnimationFrame',
        vi.fn(callback => scheduledFrames.push(callback)),
    );
    const view = createRenderView();

    view.render(createConnectedNodes('player_1'));
    expect(view.ctx.lineTo).toHaveBeenCalledTimes(1);

    scheduledFrames[0]();
    expect(view.ctx.lineTo).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
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
