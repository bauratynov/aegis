/**
 * Aegis DevTools — in-page inspector, built with Aegis itself. No extension, no build.
 * Loaded lazily by the engine (`Aegis.dev.panel()`, `?aegis-devtools`) or by hand:
 * `import('@aegisjs/engine/devtools').then(m => m.open())`.
 *
 * @version 0.7.2
 * @license MIT
 */

import type { WarningInfo } from './aegis.js';

/** What `open()` returns: the mounted panel, closed again with `close()` */
export interface DevtoolsHandle {
    close(): void;
}

/** Mount the panel (bottom right, in a shadow root). Calling it twice returns the same handle */
export function open(): DevtoolsHandle;

/** Unmount the panel opened by `open()`. A no-op when nothing is open */
export function close(): void;

/**
 * Print the explanation of a warning code (E001, S004 …) to the console and return the same text.
 * An unknown code returns the list of the codes that are known.
 */
export function explain(code: string): string;

/** The corner toast for a warning — called by the engine in dev mode; a click opens the panel */
export function notify(info: WarningInfo): void;

/**
 * The source line behind a warning, with a caret under the offending `${}`.
 * `at` carries the file URL (`WarningInfo.url`); the file is fetched once and cached.
 * Resolves to `null` when the source is unavailable or the position is not found.
 */
export function snippet(
    at: { url?: string | null; site?: string | null } | null | undefined,
    strings?: readonly string[] | null,
    index?: number | null,
    token?: string | null,
): Promise<string | null>;
