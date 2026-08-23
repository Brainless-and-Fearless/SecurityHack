import { describe, expect, test } from 'vitest';
import { Model } from '../js/Model.js';

describe('Model', () => {
    test('applyGameState stores backend game state', () => {
        const model = new Model();

        model.applyGameState('game_123', {
            status: 'running',
            remaining_time_seconds: 900,
            players: {
                player_1: {
                    id: 'player_1',
                    nickname: 'Alice',
                    score: 5,
                    resources: 20,
                    owned_node_ids: ['node_1'],
                },
            },
            nodes: {
                node_1: {
                    id: 'node_1',
                    owner_id: 'player_1',
                    defence_level: 'K1',
                    neighbor_ids: [],
                    active_attack_player_id: null,
                },
            },
            tasks: {},
        });

        expect(model.state.gameId).toBe('game_123');
        expect(model.state.status).toBe('running');
        expect(model.state.remainingTimeSeconds).toBe(900);

        expect(
            model.state.players.player_1.nickname
        ).toBe('Alice');

        expect(
            model.state.players.player_1.resources
        ).toBe(20);

        expect(
            model.state.nodes.node_1.owner_id
        ).toBe('player_1');

        expect(
            model.state.nodes.node_1.defence_level
        ).toBe('K1');
    });
});

test('initial model state matches authoritative game structure', () => {
    const model = new Model();

    expect(model.state).toEqual({
        gameId: null,
        status: 'waiting',
        players: {},
        nodes: {},
        tasks: {},
        remainingTimeSeconds: 0,
    });
});