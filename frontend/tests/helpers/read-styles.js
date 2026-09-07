import { readFileSync } from 'node:fs';

// Follow the same stylesheet imports as index.html, in cascade order.
export function readStyles(url = new URL('../../css/style.css', import.meta.url)) {
    return readFileSync(url, 'utf8').replace(
        /@import\s+url\(["']([^"']+)["']\);/g,
        (_, path) => readStyles(new URL(path, url)),
    );
}
