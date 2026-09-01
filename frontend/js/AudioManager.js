const AUDIO_BASE_PATH = '../audio/';

const AUDIO_FILES = {
    music: 'Midnight_Protocol.mp3',
    ticking: 'clock_ticking.mp3',
    success: 'success.mp3',
    click: 'click.mp3',
    win: 'win.mp3',
    alarm: 'timer_alarm1.mp3',
    wrong: 'wrong_answer.mp3',
};

const AUDIO_VOLUMES = {
    music: 0.24,
    ticking: 0.10,
    success: 0.55,
    click: 0.42,
    win: 0.65,
    alarm: 0.65,
    wrong: 0.55,
};

const EFFECT_COOLDOWNS_MS = {
    click: 70,
    success: 100,
    wrong: 100,
    alarm: 100,
    win: 100,
};

export class AudioManager {
    constructor() {
        this.music = this._createAudio('music', true);
        this.ticking = this._createAudio('ticking', true);
        this.effects = new Map();
        this.lastPlayedAt = new Map();
        this.isUnlocked = false;
        this.isMusicPlaying = false;
        this.isTickingPlaying = false;
        this._isMusicStarting = false;
        this._isTickingStarting = false;
        this._musicPlaybackGeneration = 0;
        this._tickingPlaybackGeneration = 0;
        this.hasPlayedFinishSequence = false;
        this._unlockHandler = null;
        this._finishAlarmEndedHandler = null;

        for (const effectName of ['success', 'click', 'win', 'alarm', 'wrong']) {
            this.effects.set(
                effectName,
                this._createAudio(effectName, false)
            );
        }

        this._installAutoplayUnlock();
    }

    _createAudio(name, loop) {
        const audio = new Audio(`${AUDIO_BASE_PATH}${AUDIO_FILES[name]}`);
        audio.preload = 'auto';
        audio.loop = loop;
        audio.volume = AUDIO_VOLUMES[name];
        return audio;
    }

    _installAutoplayUnlock() {
        this._unlockHandler = () => {
            this.unlock();
        };

        document.addEventListener('pointerdown', this._unlockHandler, {
            once: true,
            passive: true,
        });

        document.addEventListener('keydown', this._unlockHandler, {
            once: true,
            passive: true,
        });
    }

    unlock() {
        if (this.isUnlocked) {
            return;
        }

        const wasMuted = this.music.muted;
        this.music.muted = true;
        this.music.currentTime = 0;

        const playback = this.music.play();
        if (!playback || typeof playback.then !== 'function') {
            this.music.pause();
            this.music.muted = wasMuted;
            this.isUnlocked = true;
            return;
        }

        playback
            .then(() => {
                this.music.pause();
                this.music.currentTime = 0;
                this.music.muted = wasMuted;
                this.isUnlocked = true;
            })
            .catch(() => {
                this.music.muted = wasMuted;
            });
    }

    startMusic() {
        if (this.isMusicPlaying || this._isMusicStarting) {
            return;
        }

        const playbackGeneration =
            ++this._musicPlaybackGeneration;
        this._isMusicStarting = true;
        this.music.loop = true;
        this.music.volume = AUDIO_VOLUMES.music;

        const playback = this.music.play();
        if (!playback || typeof playback.then !== 'function') {
            this.isMusicPlaying = true;
            this._isMusicStarting = false;
            return;
        }

        playback
            .then(() => {
                if (
                    playbackGeneration
                    === this._musicPlaybackGeneration
                ) {
                    this.isMusicPlaying = true;
                    this._isMusicStarting = false;
                }
            })
            .catch(() => {
                if (
                    playbackGeneration
                    === this._musicPlaybackGeneration
                ) {
                    this.isMusicPlaying = false;
                    this._isMusicStarting = false;
                }
            });
    }

    stopMusic(resetPosition = true) {
        this._musicPlaybackGeneration += 1;
        this._isMusicStarting = false;
        this.music.pause();
        if (resetPosition) {
            this.music.currentTime = 0;
        }
        this.isMusicPlaying = false;
    }

    startTicking() {
        if (this.isTickingPlaying || this._isTickingStarting) {
            return;
        }

        const playbackGeneration =
            ++this._tickingPlaybackGeneration;
        this._isTickingStarting = true;
        this.ticking.loop = true;
        this.ticking.volume = AUDIO_VOLUMES.ticking;

        const playback = this.ticking.play();
        if (!playback || typeof playback.then !== 'function') {
            this.isTickingPlaying = true;
            this._isTickingStarting = false;
            return;
        }

        playback
            .then(() => {
                if (
                    playbackGeneration
                    === this._tickingPlaybackGeneration
                ) {
                    this.isTickingPlaying = true;
                    this._isTickingStarting = false;
                }
            })
            .catch(() => {
                if (
                    playbackGeneration
                    === this._tickingPlaybackGeneration
                ) {
                    this.isTickingPlaying = false;
                    this._isTickingStarting = false;
                }
            });
    }

    stopTicking(resetPosition = true) {
        this._tickingPlaybackGeneration += 1;
        this._isTickingStarting = false;
        this.ticking.pause();
        if (resetPosition) {
            this.ticking.currentTime = 0;
        }
        this.isTickingPlaying = false;
    }

    updateMatchTimer(remainingSeconds) {
        if (remainingSeconds > 0 && remainingSeconds <= 30) {
            this.startTicking();
        } else if (remainingSeconds > 30 || remainingSeconds <= 0) {
            this.stopTicking();
        }
    }

    playEffect(name) {
        const audio = this.effects.get(name);
        if (!audio) {
            return Promise.resolve();
        }

        const now = performance.now();
        const lastPlayedAt = this.lastPlayedAt.get(name) ?? -Infinity;
        const cooldown = EFFECT_COOLDOWNS_MS[name] ?? 0;

        if (now - lastPlayedAt < cooldown) {
            return Promise.resolve();
        }

        this.lastPlayedAt.set(name, now);
        audio.currentTime = 0;
        audio.volume = AUDIO_VOLUMES[name];

        const playback = audio.play();
        if (!playback || typeof playback.catch !== 'function') {
            return Promise.resolve();
        }

        return playback.catch(() => {});
    }

    playFinishSequence(isWinner) {
        if (this.hasPlayedFinishSequence) {
            return;
        }

        this.hasPlayedFinishSequence = true;
        this.stopTicking();
        this.stopMusic();

        const alarm = this.effects.get('alarm');
        if (!alarm) {
            if (isWinner) {
                this.playEffect('win');
            }
            return;
        }

        alarm.currentTime = 0;
        alarm.volume = AUDIO_VOLUMES.alarm;

        const finishAlarm = () => {
            if (this._finishAlarmEndedHandler) {
                alarm.removeEventListener(
                    'ended',
                    this._finishAlarmEndedHandler,
                );
                this._finishAlarmEndedHandler = null;
            }

            if (isWinner) {
                this.playEffect('win');
            }
        };

        this._finishAlarmEndedHandler = finishAlarm;
        alarm.addEventListener('ended', finishAlarm, { once: true });

        let playback;
        try {
            playback = alarm.play();
        } catch {
            finishAlarm();
            return;
        }

        if (!playback || typeof playback.then !== 'function') {
            return;
        }

        playback
            .catch(() => {
                finishAlarm();
            });
    }

    resetForNewMatch() {
        const alarm = this.effects.get('alarm');
        if (alarm && this._finishAlarmEndedHandler) {
            alarm.removeEventListener(
                'ended',
                this._finishAlarmEndedHandler,
            );
            this._finishAlarmEndedHandler = null;
        }

        this.stopTicking();
        this.stopMusic();
        this.hasPlayedFinishSequence = false;
    }
}
