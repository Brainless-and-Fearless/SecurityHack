import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';


test('game UI contains one explicit forfeit action and confirmation', () => {
    const html = readFileSync(
        new URL('../index.html', import.meta.url),
        'utf8',
    );

    for (const id of [
        'forfeit-game-btn',
        'forfeit-confirm-panel',
        'forfeit-stay-btn',
        'forfeit-confirm-btn',
    ]) {
        expect(html.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
    }
    expect(html).toContain('Выйти из игры?');
    expect(html).toContain('Вы покинете текущий матч.');
});
