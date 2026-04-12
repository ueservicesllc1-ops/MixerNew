/**
 * Zion / NextGen UI — playback snapshot helpers (JS only; no native engine changes).
 * Single bridge: NextGenMixerBridge.getSnapshot() → positionSec, durationSec.
 */
import { NextGenMixerBridge } from './NextGenNativeEngine.js';

/** Controlled UI polling interval (ms). */
export const NEXTGEN_UI_POLL_MS = 135;

export function parseNextGenSnapshotJson(jsonStr) {
    if (!jsonStr || typeof jsonStr !== 'string') {
        return { positionSec: 0, durationSec: 0, raw: null };
    }
    try {
        const o = JSON.parse(jsonStr);
        const positionSec =
            typeof o.positionSec === 'number' && Number.isFinite(o.positionSec) ? o.positionSec : 0;
        const durationSec =
            typeof o.durationSec === 'number' && Number.isFinite(o.durationSec) ? o.durationSec : 0;
        return { positionSec, durationSec, raw: o };
    } catch {
        return { positionSec: 0, durationSec: 0, raw: null };
    }
}

export async function fetchNextGenPlaybackSnapshot() {
    const { json } = await NextGenMixerBridge.getSnapshot();
    return parseNextGenSnapshotJson(json);
}
