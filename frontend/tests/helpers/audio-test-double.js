import { vi } from 'vitest';


export class AudioTestDouble {
    static instances = [];

    static reset() {
        AudioTestDouble.instances = [];
    }

    constructor(src = '') {
        this.src = src;
        this.preload = '';
        this.loop = false;
        this.volume = 1;
        this.muted = false;
        this.currentTime = 0;
        this._listeners = new Map();
        this._playImplementation = () => Promise.resolve();

        this.play = vi.fn(
            () => this._playImplementation()
        );
        this.pause = vi.fn();
        this.addEventListener = vi.fn(
            (type, listener, options = {}) => {
                const listeners = this._listeners.get(type) ?? [];
                listeners.push({
                    listener,
                    once: options?.once === true,
                });
                this._listeners.set(type, listeners);
            }
        );
        this.removeEventListener = vi.fn(
            (type, listener) => {
                const listeners = this._listeners.get(type) ?? [];
                this._listeners.set(
                    type,
                    listeners.filter(entry => entry.listener !== listener),
                );
            }
        );

        AudioTestDouble.instances.push(this);
    }

    setPlayImplementation(implementation) {
        this._playImplementation = implementation;
    }

    dispatchEvent(event) {
        const normalizedEvent = typeof event === 'string'
            ? { type: event, target: this }
            : { target: this, ...event };
        const listeners = [
            ...(this._listeners.get(normalizedEvent.type) ?? []),
        ];

        for (const entry of listeners) {
            entry.listener.call(this, normalizedEvent);
            if (entry.once) {
                this.removeEventListener(
                    normalizedEvent.type,
                    entry.listener,
                );
            }
        }

        return true;
    }

    dispatchEnded() {
        this.dispatchEvent('ended');
    }
}
