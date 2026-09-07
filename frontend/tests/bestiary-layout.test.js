import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { readStyles } from './helpers/read-styles.js';


test('Bestiary panel uses the frozen left-side layout', () => {
    const css = readStyles();
    const panelRule = css.match(/\.bestiary-panel\s*\{([^}]*)\}/s)?.[1];

    expect(panelRule).toBeDefined();
    expect(panelRule).toMatch(/left:\s*24px/);
    expect(panelRule).toMatch(/right:\s*auto/);
    expect(panelRule).not.toMatch(/top:\s*24px/);
    expect(panelRule).toMatch(/top:\s*(?:9[6-9]|1\d\d)px/);
    expect(panelRule).toMatch(/width:\s*210px/);
    expect(panelRule).toMatch(/bottom:\s*24px/);
    expect(panelRule).toMatch(/overflow:\s*auto/);

    const expandedRule = css.match(
        /\.bestiary-panel\.is-expanded\s*\{([^}]*)\}/s,
    )?.[1];
    expect(expandedRule).toMatch(/width:\s*360px/);
});


test('Bestiary and task option buttons use explicit dark theme surfaces', () => {
    const css = readStyles();
    const bestiaryButtonRule = css.match(
        /\.bestiary-module-btn\s*\{([^}]*)\}/s,
    )?.[1];
    const taskOptionRule = css.match(
        /\.task-option-btn\s*\{([^}]*)\}/s,
    )?.[1];

    for (const rule of [bestiaryButtonRule, taskOptionRule]) {
        expect(rule).toBeDefined();
        expect(rule).toMatch(/background:[^;]*rgba\(18,\s*22,\s*27,/s);
        expect(rule).toMatch(/color:\s*var\(--text-color\)/);
        expect(rule).toMatch(/border:\s*1px\s+solid/);
    }

    for (const selector of ['bestiary-module-btn', 'task-option-btn']) {
        const hoverRule = css.match(new RegExp(
            `\\.${selector}:hover:not\\(:disabled\\)[^{]*\\{([^}]*)\\}`, 's',
        ))?.[1];
        expect(hoverRule).toMatch(/background:[^;]*rgba\(31,\s*37,\s*45,/s);
        expect(hoverRule).toMatch(/color:\s*var\(--text-color\)/);
    }
    expect(css).toMatch(/\.task-option-btn:disabled\s*\{[^}]*color:\s*var\(--surface-muted\)/s);
});

test('entry mode centers the shared panel without overriding game positioning', () => {
    const css = readStyles();
    const entryRule = css.match(
        /\.bestiary-panel\.is-entry-mode\s*,\s*\.bestiary-panel\.is-entry-mode\.is-expanded\s*\{([^}]*)\}/s,
    )?.[1];
    expect(entryRule).toBeDefined();
    expect(entryRule).toMatch(/position:\s*fixed/);
    expect(entryRule).toMatch(/top:\s*50%/);
    expect(entryRule).toMatch(/left:\s*50%/);
    expect(entryRule).toMatch(/bottom:\s*auto/);
    expect(entryRule).toMatch(/transform:\s*translate\(-50%,\s*-50%\)/);
    expect(entryRule).toMatch(/width:\s*70vw\s*;/);
    expect(entryRule).toMatch(/max-width:\s*calc\(100vw\s*-\s*48px\)/);
    expect(entryRule).toMatch(/max-height:\s*calc\(100dvh\s*-\s*48px\)/);
});

test('task, K0 and upgrade actions have themed surfaces for all interaction states', () => {
    const css = readStyles();
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const ids = ['submit-task-btn', 'bestiary-challenge-submit', 'upgrade-node-btn'];
    const actionRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(([, selector]) => ids.every((id) => selector.includes(`#${id}`)));

    for (const id of ids) {
        expect(html).toMatch(new RegExp(`id="${id}"[^>]*class="btn-success"|id="${id}"[^>]*class="[^"]*btn-success`));
    }
    for (const state of ['', ':hover', ':focus-visible', ':active', ':disabled']) {
        const rule = actionRules.find(([, selector]) => state
            ? selector.includes(state) && (state !== ':disabled' || !selector.includes(':not('))
            : !selector.includes(':hover') && !selector.includes(':focus-visible')
                && !selector.includes(':active') && !selector.includes(':disabled'))?.[2];
        expect(rule, state || 'normal').toBeDefined();
        expect(rule).toMatch(/background:\s*var\(--bg-(?:surface|surface-hover|deep)\)/);
        expect(rule).toMatch(/color:\s*var\(--text-(?:color|muted)\)/);
        if (state === ':disabled') expect(rule).toMatch(/opacity:\s*1\s*;/);
    }
});


test('entry menu exposes one shared Bestiary panel outside the game screen', () => {
    const html = readFileSync(
        new URL('../index.html', import.meta.url),
        'utf8',
    );

    expect(html).toMatch(/id="open-bestiary-btn"[^>]*>\s*Бестиарий\s*</);
    expect(html.match(/id="bestiary-panel"/g)).toHaveLength(1);
    expect(html).toMatch(/<\/div>\s*<aside id="bestiary-panel"/);
});
