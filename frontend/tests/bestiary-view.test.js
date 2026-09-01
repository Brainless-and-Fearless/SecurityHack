import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BestiaryView } from '../js/BestiaryView.js';


function createClassList(initial = []) {
    const values = new Set(initial);
    return {
        add: (...names) => names.forEach((name) => values.add(name)),
        remove: (...names) => names.forEach((name) => values.delete(name)),
        toggle: (name, force) => {
            if (force === undefined) {
                force = !values.has(name);
            }
            force ? values.add(name) : values.delete(name);
        },
        contains: (name) => values.has(name),
    };
}


function createElement(id = '') {
    const listeners = {};
    return {
        id,
        textContent: '',
        value: '',
        disabled: false,
        className: '',
        classList: createClassList(),
        dataset: {},
        children: [],
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        replaceChildren(...children) {
            this.children = children;
        },
        addEventListener(type, listener) {
            listeners[type] ??= [];
            listeners[type].push(listener);
        },
        click() {
            for (const listener of listeners.click ?? []) {
                listener({ preventDefault: vi.fn() });
            }
        },
    };
}


function createBestiaryDom() {
    const ids = [
        'bestiary-panel',
        'bestiary-catalog',
        'bestiary-detail',
        'bestiary-back-btn',
        'bestiary-close-btn',
        'bestiary-module-title',
        'bestiary-module-categories',
        'bestiary-content',
        'bestiary-challenge',
        'bestiary-challenge-question',
        'bestiary-challenge-answer',
        'bestiary-challenge-submit',
        'bestiary-challenge-feedback',
    ];
    const elements = Object.fromEntries(
        ids.map((id) => [id, createElement(id)]),
    );
    elements['bestiary-detail'].classList.add('hidden');
    elements['bestiary-panel'].classList.add('hidden');
    elements['bestiary-close-btn'].classList.add('hidden');
    elements['bestiary-content'].classList.add('hidden');
    elements['bestiary-challenge'].classList.add('hidden');

    vi.stubGlobal('document', {
        getElementById: vi.fn((id) => elements[id] ?? null),
        createElement: vi.fn((tagName) => createElement(tagName)),
    });

    return elements;
}


function modules(count = 11) {
    return Array.from({ length: count }, (_, index) => ({
        id: `module_${index}`,
        title: `Module ${index}`,
        categories: [`category_${index}`],
        is_locked: index % 2 === 0,
    }));
}


describe('BestiaryView', () => {
    let elements;
    let view;

    beforeEach(() => {
        elements = createBestiaryDom();
        view = new BestiaryView();
    });

    test('renders every authoritative catalog module and its lock state', () => {
        view.renderCatalog(modules());

        const buttons = elements['bestiary-catalog'].children;
        expect(buttons).toHaveLength(11);
        expect(buttons[0].dataset.moduleId).toBe('module_0');
        expect(buttons[0].className).toContain('is-locked');
        expect(buttons[1].className).toContain('is-readable');
    });

    test('module selection exposes authoritative module id', () => {
        const onModuleSelected = vi.fn();
        view.setHandlers({ onModuleSelected });
        view.renderCatalog(modules(2));

        elements['bestiary-catalog'].children[1].click();

        expect(onModuleSelected).toHaveBeenCalledWith('module_1');
    });

    test('one view supports entry and game lifecycle modes', () => {
        const onCloseRequested = vi.fn();
        view.setHandlers({ onCloseRequested });

        view.showForEntry();

        expect(elements['bestiary-panel'].classList.contains('hidden'))
            .toBe(false);
        expect(elements['bestiary-panel'].classList.contains('is-entry-mode'))
            .toBe(true);
        expect(elements['bestiary-close-btn'].classList.contains('hidden'))
            .toBe(false);

        elements['bestiary-close-btn'].click();
        expect(onCloseRequested).toHaveBeenCalledTimes(1);

        view.showForGame();
        expect(elements['bestiary-panel'].classList.contains('hidden'))
            .toBe(false);
        expect(elements['bestiary-panel'].classList.contains('is-entry-mode'))
            .toBe(false);
        expect(elements['bestiary-close-btn'].classList.contains('hidden'))
            .toBe(true);

        view.hide();
        expect(elements['bestiary-panel'].classList.contains('hidden'))
            .toBe(true);
    });

    test('renders locked module metadata and challenge controls', () => {
        view.renderLocked({
            module: {
                id: 'modern_encryption',
                title: 'Modern encryption',
                categories: ['AES', 'AEAD'],
            },
            challenge: {
                id: 'gate_xor_009',
                question: 'Calculate XOR.',
            },
        });

        expect(elements['bestiary-module-title'].textContent)
            .toBe('Modern encryption');
        expect(elements['bestiary-module-categories'].textContent)
            .toBe('AES · AEAD');
        expect(elements['bestiary-challenge-question'].textContent)
            .toBe('Calculate XOR.');
        expect(elements['bestiary-challenge'].classList.contains('hidden'))
            .toBe(false);
        expect(elements['bestiary-challenge-answer'].disabled).toBe(false);
    });

    test('challenge submit exposes ids and answer exactly once', () => {
        const onChallengeSubmit = vi.fn(() => true);
        view.setHandlers({ onChallengeSubmit });
        view.renderLocked({
            module: { id: 'modern_encryption', title: 'Title', categories: [] },
            challenge: { id: 'gate_xor_009', question: 'Question' },
        });
        elements['bestiary-challenge-answer'].value = '0010';

        elements['bestiary-challenge-submit'].click();
        elements['bestiary-challenge-submit'].click();

        expect(onChallengeSubmit).toHaveBeenCalledTimes(1);
        expect(onChallengeSubmit).toHaveBeenCalledWith(
            'modern_encryption',
            'gate_xor_009',
            '0010',
        );
        expect(elements['bestiary-challenge-answer'].disabled).toBe(true);
        expect(elements['bestiary-challenge-submit'].disabled).toBe(true);
    });

    test('failed challenge retains gate and enables retry', () => {
        const onChallengeSubmit = vi.fn(() => true);
        view.setHandlers({ onChallengeSubmit });
        view.renderLocked({
            module: { id: 'modern_encryption', title: 'Title', categories: [] },
            challenge: { id: 'gate_xor_009', question: 'Same question' },
        });
        elements['bestiary-challenge-answer'].value = 'wrong';
        elements['bestiary-challenge-submit'].click();

        view.showChallengeFailure({
            module_id: 'modern_encryption',
            challenge_id: 'gate_xor_009',
        });

        expect(elements['bestiary-challenge-question'].textContent)
            .toBe('Same question');
        expect(elements['bestiary-challenge-feedback'].textContent)
            .not.toBe('');
        expect(elements['bestiary-challenge-answer'].disabled).toBe(false);
        expect(elements['bestiary-challenge-submit'].disabled).toBe(false);

        elements['bestiary-challenge-submit'].click();
        expect(onChallengeSubmit).toHaveBeenCalledTimes(2);
    });

    test('protocol error recovers a pending challenge submission', () => {
        const onChallengeSubmit = vi.fn(() => true);
        view.setHandlers({ onChallengeSubmit });
        view.renderLocked({
            module: { id: 'module_1', title: 'Title', categories: [] },
            challenge: { id: 'gate_1', question: 'Question' },
        });
        elements['bestiary-challenge-answer'].value = 'answer';
        elements['bestiary-challenge-submit'].click();

        view.recoverChallengeSubmission();

        expect(elements['bestiary-challenge-answer'].disabled).toBe(false);
        expect(elements['bestiary-challenge-submit'].disabled).toBe(false);
        elements['bestiary-challenge-submit'].click();
        expect(onChallengeSubmit).toHaveBeenCalledTimes(2);
    });

    test('opened article clears stale challenge and failure state', () => {
        view.renderLocked({
            module: { id: 'module_1', title: 'Locked', categories: [] },
            challenge: { id: 'gate_1', question: 'Question' },
        });
        view.showChallengeFailure({ module_id: 'module_1', challenge_id: 'gate_1' });

        view.renderOpened({
            id: 'module_1',
            title: 'Readable',
            categories: ['crypto'],
            content: 'Article body',
        });

        expect(elements['bestiary-content'].textContent).toBe('Article body');
        expect(elements['bestiary-content'].classList.contains('hidden'))
            .toBe(false);
        expect(elements['bestiary-challenge'].classList.contains('hidden'))
            .toBe(true);
        expect(elements['bestiary-challenge-question'].textContent).toBe('');
        expect(elements['bestiary-challenge-feedback'].textContent).toBe('');
    });

    test('unlocked article marks catalog entry readable and clears failure', () => {
        view.renderCatalog([{
            id: 'module_1',
            title: 'Module',
            categories: [],
            is_locked: true,
        }]);
        view.renderLocked({
            module: { id: 'module_1', title: 'Module', categories: [] },
            challenge: { id: 'gate_1', question: 'Question' },
        });
        view.showChallengeFailure({ module_id: 'module_1', challenge_id: 'gate_1' });

        view.renderUnlocked({
            id: 'module_1',
            title: 'Module',
            categories: [],
            content: 'Unlocked article',
        });

        expect(elements['bestiary-catalog'].children[0].className)
            .toContain('is-readable');
        expect(elements['bestiary-challenge-feedback'].textContent).toBe('');
    });

    test('renders server content as inert text rather than HTML', () => {
        const payload = '<script>globalThis.compromised = true</script>';

        view.renderOpened({
            id: 'safe_module',
            title: '<img src=x onerror=alert(1)>',
            categories: ['<b>unsafe-looking</b>'],
            content: payload,
        });

        expect(elements['bestiary-content'].textContent).toBe(payload);
        expect(elements['bestiary-content'].children).toEqual([]);
        expect(elements['bestiary-module-title'].textContent)
            .toBe('<img src=x onerror=alert(1)>');
        expect(document.createElement).not.toHaveBeenCalledWith('script');
    });
});
