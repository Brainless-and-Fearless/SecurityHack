import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { readStyles } from './helpers/read-styles.js';

test('one final results panel has distinct themed outcomes and viewport-safe scrolling', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = readStyles();
    expect(html.match(/id="game-finished-panel"/g)).toHaveLength(1);
    expect(html).toContain('<tbody id="game-finished-details">');
    const panel = css.match(/#game-finished-panel\s*\{([^}]*)\}/)?.[1];
    expect(panel).toMatch(/max-height:\s*calc\(100dvh - 32px\)/);
    expect(panel).toMatch(/overflow-y:\s*auto/);
    for (const [state, color] of [['victory', 'success-color'], ['defeat', 'pink-accent'], ['draw', 'warning-color']]) {
        const rule = css.match(new RegExp(`#game-finished-panel\\.is-${state}\\s*\\{([^}]*)\\}`))?.[1];
        expect(rule).toContain(`var(--${color})`);
    }
});
