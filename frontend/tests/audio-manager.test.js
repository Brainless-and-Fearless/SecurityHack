import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AudioManager } from '../js/AudioManager.js';
import { AudioTestDouble } from './helpers/audio-test-double.js';


function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}


async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}


describe('AudioManager', () => {
    beforeEach(() => {
        vi.stubGlobal('document', {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });
    });

    test('constructs music, ticking, and effect audio objects', () => {
        const manager = new AudioManager();

        expect(AudioTestDouble.instances).toHaveLength(7);
        expect(manager.music.src).toContain('Midnight_Protocol.mp3');
        expect(manager.music.preload).toBe('auto');
        expect(manager.music.loop).toBe(true);
        expect(manager.ticking.src).toContain('clock_ticking.mp3');
        expect(manager.ticking.loop).toBe(true);
        expect([...manager.effects.keys()]).toEqual([
            'success',
            'click',
            'win',
            'alarm',
            'wrong',
        ]);
        expect([...manager.effects.values()].every(audio => !audio.loop))
            .toBe(true);
    });

    test('startMusic becomes playing only after play resolves', async () => {
        const manager = new AudioManager();
        const playback = deferred();
        manager.music.setPlayImplementation(() => playback.promise);

        manager.startMusic();

        expect(manager.music.play).toHaveBeenCalledTimes(1);
        expect(manager.isMusicPlaying).toBe(false);

        playback.resolve();
        await playback.promise;
        await flushPromises();

        expect(manager.isMusicPlaying).toBe(true);
    });

    test('startMusic remains stopped when play rejects', async () => {
        const manager = new AudioManager();
        manager.music.setPlayImplementation(
            () => Promise.reject(new Error('blocked')),
        );

        manager.startMusic();
        await flushPromises();

        expect(manager.isMusicPlaying).toBe(false);
    });

    test('late play resolution cannot restart stopped loop state', async () => {
        const manager = new AudioManager();
        const musicPlayback = deferred();
        const tickingPlayback = deferred();
        manager.music.setPlayImplementation(() => musicPlayback.promise);
        manager.ticking.setPlayImplementation(() => tickingPlayback.promise);

        manager.startMusic();
        manager.startTicking();
        manager.stopMusic();
        manager.stopTicking();

        musicPlayback.resolve();
        tickingPlayback.resolve();
        await Promise.all([musicPlayback.promise, tickingPlayback.promise]);
        await flushPromises();

        expect(manager.isMusicPlaying).toBe(false);
        expect(manager.isTickingPlaying).toBe(false);
    });

    test('stopMusic pauses and optionally resets playback position', () => {
        const manager = new AudioManager();
        manager.isMusicPlaying = true;
        manager.music.currentTime = 12;

        manager.stopMusic(false);
        expect(manager.music.pause).toHaveBeenCalledTimes(1);
        expect(manager.music.currentTime).toBe(12);
        expect(manager.isMusicPlaying).toBe(false);

        manager.stopMusic();
        expect(manager.music.currentTime).toBe(0);
    });

    test('startTicking and stopTicking mirror music state behavior', async () => {
        const manager = new AudioManager();
        const playback = deferred();
        manager.ticking.setPlayImplementation(() => playback.promise);

        manager.startTicking();
        expect(manager.isTickingPlaying).toBe(false);

        playback.resolve();
        await playback.promise;
        await flushPromises();
        expect(manager.isTickingPlaying).toBe(true);

        manager.ticking.currentTime = 4;
        manager.stopTicking();
        expect(manager.ticking.pause).toHaveBeenCalledTimes(1);
        expect(manager.ticking.currentTime).toBe(0);
        expect(manager.isTickingPlaying).toBe(false);
    });

    test('updateMatchTimer ticks from 30 through 1 and stops outside range', async () => {
        const manager = new AudioManager();

        manager.updateMatchTimer(31);
        expect(manager.isTickingPlaying).toBe(false);

        manager.updateMatchTimer(30);
        await flushPromises();
        expect(manager.isTickingPlaying).toBe(true);
        expect(manager.ticking.play).toHaveBeenCalledTimes(1);

        manager.updateMatchTimer(1);
        expect(manager.isTickingPlaying).toBe(true);
        expect(manager.ticking.play).toHaveBeenCalledTimes(1);

        manager.updateMatchTimer(0);
        expect(manager.isTickingPlaying).toBe(false);
    });

    test('effect cooldown prevents rapid duplicate playback', async () => {
        const manager = new AudioManager();
        const now = vi.spyOn(performance, 'now');
        now.mockReturnValueOnce(1000);
        now.mockReturnValueOnce(1050);
        now.mockReturnValueOnce(1200);

        await manager.playEffect('click');
        await manager.playEffect('click');
        await manager.playEffect('click');

        expect(manager.effects.get('click').play).toHaveBeenCalledTimes(2);
    });

    test('resetForNewMatch stops loops and resets finish state', () => {
        const manager = new AudioManager();
        manager.isMusicPlaying = true;
        manager.isTickingPlaying = true;
        manager.hasPlayedFinishSequence = true;

        manager.resetForNewMatch();

        expect(manager.music.pause).toHaveBeenCalledTimes(1);
        expect(manager.ticking.pause).toHaveBeenCalledTimes(1);
        expect(manager.isMusicPlaying).toBe(false);
        expect(manager.isTickingPlaying).toBe(false);
        expect(manager.hasPlayedFinishSequence).toBe(false);
    });

    test('winner finish waits for alarm ended before playing win effect', async () => {
        const manager = new AudioManager();
        const alarm = manager.effects.get('alarm');
        const win = manager.effects.get('win');

        manager.playFinishSequence(true);
        await flushPromises();

        expect(alarm.play).toHaveBeenCalledTimes(1);
        expect(win.play).not.toHaveBeenCalled();

        alarm.dispatchEnded();
        await flushPromises();

        expect(win.play).toHaveBeenCalledTimes(1);

        manager.playFinishSequence(true);
        expect(alarm.play).toHaveBeenCalledTimes(1);
        expect(win.play).toHaveBeenCalledTimes(1);
    });

    test('non-winner finish plays alarm without win effect', async () => {
        const manager = new AudioManager();
        const alarm = manager.effects.get('alarm');
        const win = manager.effects.get('win');

        manager.playFinishSequence(false);
        await flushPromises();
        alarm.dispatchEnded();

        expect(alarm.play).toHaveBeenCalledTimes(1);
        expect(win.play).not.toHaveBeenCalled();
    });

    test('winner falls back to win effect if alarm cannot start', async () => {
        const manager = new AudioManager();
        manager.effects.get('alarm').setPlayImplementation(
            () => Promise.reject(new Error('alarm blocked')),
        );

        manager.playFinishSequence(true);
        await flushPromises();

        expect(manager.effects.get('win').play).toHaveBeenCalledTimes(1);
        expect(manager.hasPlayedFinishSequence).toBe(true);
    });
});
