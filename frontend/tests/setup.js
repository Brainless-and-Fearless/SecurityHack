import { beforeEach, vi } from 'vitest';
import { AudioTestDouble } from './helpers/audio-test-double.js';


beforeEach(() => {
    AudioTestDouble.reset();
    vi.stubGlobal('Audio', AudioTestDouble);
});
