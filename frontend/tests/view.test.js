import { describe, expect, test } from 'vitest';
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