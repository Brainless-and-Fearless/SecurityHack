import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';


test('Bestiary panel uses the frozen left-side layout', () => {
    const css = readFileSync(
        new URL('../css/style.css', import.meta.url),
        'utf8',
    );
    const panelRule = css.match(/\.bestiary-panel\s*\{([^}]*)\}/s)?.[1];

    expect(panelRule).toBeDefined();
    expect(panelRule).toMatch(/left:\s*24px/);
    expect(panelRule).toMatch(/right:\s*auto/);
    expect(panelRule).not.toMatch(/top:\s*24px/);
    expect(panelRule).toMatch(/top:\s*(?:9[6-9]|1\d\d)px/);
    expect(panelRule).toMatch(/width:\s*210px/);
    expect(panelRule).toMatch(/max-height:\s*calc\(100%\s*-\s*(?:12[0-9]|1[3-9]\d)px\)/);

    const expandedRule = css.match(
        /\.bestiary-panel\.is-expanded\s*\{([^}]*)\}/s,
    )?.[1];
    expect(expandedRule).toMatch(/width:\s*360px/);
});


test('Bestiary and task option buttons use explicit dark theme surfaces', () => {
    const css = readFileSync(
        new URL('../css/style.css', import.meta.url),
        'utf8',
    );
    const bestiaryButtonRule = css.match(
        /\.bestiary-module-btn\s*\{([^}]*)\}/s,
    )?.[1];
    const taskOptionRule = css.match(
        /\.task-option-btn\s*\{([^}]*)\}/s,
    )?.[1];

    for (const rule of [bestiaryButtonRule, taskOptionRule]) {
        expect(rule).toBeDefined();
        expect(rule).toMatch(/background(?:-color)?:\s*var\(--surface-1\)/);
        expect(rule).toMatch(/color:\s*var\(--text-color\)/);
        expect(rule).toMatch(/border:\s*1px\s+solid\s+var\(--surface-line\)/);
    }

    expect(css).toMatch(/\.bestiary-module-btn:hover:not\(:disabled\)[^{]*\{[^}]*background(?:-color)?:\s*var\(--surface-2\)/s);
    expect(css).toMatch(/\.task-option-btn:hover:not\(:disabled\)[^{]*\{[^}]*background(?:-color)?:\s*var\(--surface-2\)/s);
    expect(css).toMatch(/\.task-option-btn:disabled\s*\{[^}]*color:\s*var\(--surface-muted\)/s);
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
