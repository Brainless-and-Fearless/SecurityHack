import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BestiaryView } from '../js/BestiaryView.js';
import { Controller } from '../js/Controller.js';


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
        scrollTop: 0,
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
        input(value) {
            this.value = value;
            for (const listener of listeners.input ?? []) listener({ target: this });
        },
    };
}


function createBestiaryDom() {
    const ids = [
        'bestiary-panel',
        'bestiary-search',
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

    test.each([
        ['catalog', 'locked'], ['catalog', 'opened'],
        ['deep-link', 'locked'], ['deep-link', 'opened'],
    ])('%s → %s starts detail at the panel top', (source, outcome) => {
        const controller = Object.assign(Object.create(Controller.prototype), {
            bestiaryView: view,
            network: {
                connectionState: 'connected',
                openKnowledge: vi.fn(),
                listKnowledge: vi.fn(),
            },
            taskResultEducation: { knowledge_module_id: 'module_1' },
            closeTaskModal: vi.fn(function () { this.taskResultEducation = null; }),
        });
        view.setHandlers({
            onModuleSelected: (id) => controller.handleKnowledgeModuleSelected(id),
        });
        view.renderCatalog(modules());
        elements['bestiary-panel'].scrollTop = 420;
        elements['bestiary-content'].scrollTop = 180;

        if (source === 'catalog') {
            elements['bestiary-catalog'].children[1].click();
        } else {
            controller.handleOpenTaskResultKnowledge();
            expect(controller.closeTaskModal).toHaveBeenCalledOnce();
            expect(controller.bestiaryView).toBe(view);
        }
        expect(controller.network.openKnowledge).toHaveBeenCalledExactlyOnceWith('module_1');
        expect(controller.network.listKnowledge).not.toHaveBeenCalled();

        const module = { id: 'module_1', title: 'Module title', categories: ['Category'] };
        if (outcome === 'locked') {
            controller.onKnowledgeLocked({ module, challenge: { id: 'gate', question: 'Gate question' } });
            expect(elements['bestiary-challenge-question'].textContent).toBe('Gate question');
        } else {
            controller.onKnowledgeOpened({ module: { ...module, content: 'Article text' } });
            expect(elements['bestiary-content'].textContent).toBe('Article text');
        }

        expect(elements['bestiary-panel'].scrollTop).toBe(0);
        expect(elements['bestiary-content'].scrollTop).toBe(0);
        expect(elements['bestiary-module-title'].textContent).toBe('Module title');
        expect(elements['bestiary-detail'].classList.contains('hidden')).toBe(false);
        expect(elements['bestiary-catalog'].classList.contains('hidden')).toBe(true);

        // A catalog refresh must not push the article below the module list again.
        view.renderCatalog(modules());
        expect(elements['bestiary-catalog'].classList.contains('hidden')).toBe(true);
        elements['bestiary-back-btn'].click();
        expect(elements['bestiary-catalog'].classList.contains('hidden')).toBe(false);
        expect(elements['bestiary-detail'].classList.contains('hidden')).toBe(true);
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

describe('Bestiary search', () => {
    let elements, view, search, select;
    beforeEach(() => {
        vi.useFakeTimers();
        elements = createBestiaryDom();
        view = new BestiaryView();
        search = vi.fn().mockReturnValueOnce('search-1').mockReturnValueOnce('search-2');
        select = vi.fn();
        view.setHandlers({ onSearchRequested: search, onModuleSelected: select });
        view.renderCatalog(modules());
    });
    afterEach(() => {
        expect(vi.getTimerCount()).toBe(0);
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    test('debounces typing, clearing cancels the timer and restores the full catalog', () => {
        const input = elements['bestiary-search'];
        input.input('base');
        vi.advanceTimersByTime(200);
        expect(search).not.toHaveBeenCalled();
        input.input(' base64 ');
        vi.advanceTimersByTime(250);
        expect(search).toHaveBeenCalledExactlyOnceWith('base64');
        view.renderSearchResults({ request_id: 'search-1', query: 'base64', modules: modules(1) });
        expect(view.catalogButtons.size).toBe(1);
        input.input('rot');
        input.input('  ');
        vi.advanceTimersByTime(300);
        expect(search).toHaveBeenCalledTimes(1);
        expect(view.catalogButtons.size).toBe(11);
        view.renderSearchResults({ request_id: 'search-1', query: 'base64', modules: modules(1) });
        expect(view.catalogButtons.size).toBe(11);
    });

    test('ignores stale responses even if the user returns to an earlier query', () => {
        const input = elements['bestiary-search'];
        input.input('base64');
        vi.advanceTimersByTime(250);
        input.input('rot13');
        view.renderSearchResults({ request_id: 'search-1', query: 'base64', modules: modules(1) });
        expect(view.catalogButtons.size).toBe(0);
        input.input('base64');
        vi.advanceTimersByTime(250);
        view.renderSearchResults({ request_id: 'search-2', query: 'base64', modules: modules(2) });
        view.renderSearchResults({ request_id: 'search-1', query: 'base64', modules: modules(1) });
        expect(view.catalogButtons.size).toBe(2);
    });

    test('no matches shows only safe empty-result text', () => {
        elements['bestiary-search'].input('<script>no match</script>');
        vi.advanceTimersByTime(250);
        view.renderSearchResults({ request_id: 'search-1', query: '<script>no match</script>', modules: [] });
        expect(elements['bestiary-catalog'].children[0].textContent).toBe('Ничего не найдено');
        expect(elements['bestiary-catalog'].children[0].children).toEqual([]);
    });

    test.each(['locked', 'opened'])('result click reuses module selection and Back retains search after %s', (mode) => {
        elements['bestiary-search'].input('base64');
        vi.advanceTimersByTime(250);
        const module = modules(1)[0];
        view.renderSearchResults({ request_id: 'search-1', query: 'base64', modules: [module] });
        view.catalogButtons.get(module.id).click();
        expect(select).toHaveBeenCalledExactlyOnceWith(module.id);
        view.panel.scrollTop = 400;
        if (mode === 'locked') {
            view.renderLocked({ module, challenge: { id: 'gate', question: 'Question' } });
            expect(view.challenge.classList.contains('hidden')).toBe(false);
        } else {
            view.renderOpened({ ...module, content: 'Article' });
            expect(view.content.textContent).toBe('Article');
        }
        expect(view.panel.scrollTop).toBe(0);
        elements['bestiary-back-btn'].click();
        expect(elements['bestiary-search'].value).toBe('base64');
        expect(view.catalogButtons.size).toBe(1);
        expect(view.catalog.classList.contains('hidden')).toBe(false);
        elements['bestiary-search'].input('');
        expect(view.catalogButtons.size).toBe(11);
    });

    test('hiding cancels queued search and invalidates in-flight results', () => {
        elements['bestiary-search'].input('base64');
        vi.advanceTimersByTime(250);
        elements['bestiary-search'].input('rot13');
        view.hide();
        vi.advanceTimersByTime(300);
        expect(search).toHaveBeenCalledTimes(1);
        view.renderSearchResults({ request_id: 'search-1', query: 'base64', modules: modules(1) });
        expect(view.panel.classList.contains('hidden')).toBe(true);
        expect(elements['bestiary-search'].value).toBe('');
    });

    test('authoritative catalog refresh rechecks search locks and clearing keeps an unlocked module readable', () => {
        elements['bestiary-search'].input('base64');
        vi.advanceTimersByTime(250);
        view.renderSearchResults({ request_id: 'search-1', query: 'base64', modules: modules(1) });
        view.renderCatalog(modules());
        vi.advanceTimersByTime(250);
        expect(search).toHaveBeenCalledTimes(2);
        view.renderSearchResults({ request_id: 'search-2', query: 'base64', modules: modules(1) });
        view.renderUnlocked({ ...modules(1)[0], content: 'Article' });
        elements['bestiary-back-btn'].click();
        expect(view.catalogButtons.get('module_0').className).toContain('is-readable');
        elements['bestiary-search'].input('');
        expect(view.catalogButtons.size).toBe(11);
        expect(view.catalogButtons.get('module_0').className).toContain('is-readable');
    });
});
