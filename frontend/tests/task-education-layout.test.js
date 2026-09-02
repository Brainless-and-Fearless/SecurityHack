import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';


test('task modal contains one safely rendered educational topic element', () => {
    const html = readFileSync(
        new URL('../index.html', import.meta.url),
        'utf8',
    );

    expect(html.match(/id="task-topic"/g)).toHaveLength(1);
    expect(html).toMatch(
        /id="task-title"[\s\S]*id="task-topic"[\s\S]*id="task-desc"/,
    );
});


test('task modal contains one hidden themed Bestiary result action', () => {
    const html = readFileSync(
        new URL('../index.html', import.meta.url),
        'utf8',
    );

    expect(html.match(/id="task-open-bestiary-btn"/g)).toHaveLength(1);
    expect(html).toMatch(
        /id="task-open-bestiary-btn"[^>]*class="[^"]*btn-primary[^"]*hidden[^"]*"[^>]*>Открыть тему в Бестиарии</,
    );
});


test('task topic and result states use existing theme colors', () => {
    const css = readFileSync(
        new URL('../css/style.css', import.meta.url),
        'utf8',
    );

    expect(css).toMatch(/\.task-topic\s*\{[^}]*color:\s*var\(--surface-muted\)/s);
    expect(css).toMatch(/#task-modal\.is-success-result\s+#task-title\s*\{[^}]*color:\s*var\(--success-color\)/s);
    expect(css).toMatch(/#task-modal\.is-failure-result\s+#task-title\s*\{[^}]*color:\s*var\(--danger-color\)/s);
});
