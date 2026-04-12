/**
 * Isolated manual test harness for the NextGen native multitrack engine (Android).
 * Does not use or replace the production Multitrack / legacy MixerBridge flow.
 *
 * Open on device: #/nextgen-test?nextgenTest=1
 * (In dev, the panel is always available without the flag.)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { NextGenMixerBridge } from '../NextGenNativeEngine.js';

const LOG = (...a) => console.log('[NEXTGEN_TEST]', ...a);

async function getAbsolutePathInData(filename) {
    const { uri } = await Filesystem.getUri({
        path: filename,
        directory: Directory.Data,
    });
    return decodeURIComponent(uri.replace('file://', ''));
}

/** Same naming convention as NativeEngine: songId_stemName.ext */
async function buildTracksFromAppData(songId, stemNames, ext) {
    const trimmed = songId.trim();
    const tracks = [];
    for (const raw of stemNames) {
        const name = raw.trim();
        if (!name) continue;
        const filename = `${trimmed}_${name}.${ext}`;
        const path = await getAbsolutePathInData(filename);
        tracks.push({ id: name, path });
    }
    return tracks;
}

export default function NextGenTest() {
    const [searchParams, setSearchParams] = useSearchParams();
    const isNative = Capacitor.isNativePlatform();

    // TEMP: hardcoded for device testing — show full panel on launch (no ?nextgenTest=1)
    const flagOk = true;

    const unlock = useCallback(() => {
        try {
            localStorage.setItem('NEXTGEN_TEST', '1');
        } catch (_) { /* ignore */ }
        const next = new URLSearchParams(searchParams);
        next.set('nextgenTest', '1');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const [sessionJson, setSessionJson] = useState(
        () =>
            `{\n  "tracks": [\n    { "id": "vocals", "path": "/ABSOLUTE/PATH/vocals.flac" },\n    { "id": "drums", "path": "/ABSOLUTE/PATH/drums.flac" }\n  ]\n}`,
    );
    const [songId, setSongId] = useState('');
    const [stemsCsv, setStemsCsv] = useState('vocals, drums, bass');
    const [ext, setExt] = useState('flac');

    const [loadedIds, setLoadedIds] = useState([]);
    const [controlId, setControlId] = useState('');
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);

    const [snapshotText, setSnapshotText] = useState('');
    const [poll, setPoll] = useState(false);
    const [err, setErr] = useState('');

    const runSnapshot = useCallback(async () => {
        try {
            LOG('snapshot');
            const { json } = await NextGenMixerBridge.getSnapshot();
            setSnapshotText(typeof json === 'string' ? json : JSON.stringify(json));
        } catch (e) {
            LOG('snapshot error', e);
            setErr(String(e?.message ?? e));
        }
    }, []);

    useEffect(() => {
        if (!poll || !flagOk) return undefined;
        const t = setInterval(() => {
            runSnapshot();
        }, 2000);
        return () => clearInterval(t);
    }, [poll, flagOk, runSnapshot]);

    const loadFromJson = async () => {
        setErr('');
        try {
            const parsed = JSON.parse(sessionJson);
            const tracks = parsed.tracks;
            if (!Array.isArray(tracks) || tracks.length === 0) {
                throw new Error('JSON must include non-empty tracks[]');
            }
            LOG('load session', tracks);
            await NextGenMixerBridge.loadSongSession({ tracks });
            setLoadedIds(tracks.map((t) => t.id));
            setControlId(tracks[0].id);
        } catch (e) {
            LOG('load session error', e);
            setErr(String(e?.message ?? e));
        }
    };

    const loadFromAppDataPattern = async () => {
        setErr('');
        try {
            const names = stemsCsv.split(',').map((s) => s.trim()).filter(Boolean);
            const tracks = await buildTracksFromAppData(songId, names, ext);
            if (tracks.length === 0) throw new Error('No stem names');
            LOG('load session (app Data)', tracks);
            await NextGenMixerBridge.loadSongSession({ tracks });
            setLoadedIds(tracks.map((t) => t.id));
            setControlId(tracks[0].id);
            setSessionJson(JSON.stringify({ tracks }, null, 2));
        } catch (e) {
            LOG('load session (app Data) error', e);
            setErr(String(e?.message ?? e));
        }
    };

    const doPlay = async () => {
        LOG('play');
        try {
            await NextGenMixerBridge.play();
        } catch (e) {
            LOG('play error', e);
            setErr(String(e?.message ?? e));
        }
    };

    const doPause = async () => {
        LOG('pause');
        try {
            await NextGenMixerBridge.pause();
        } catch (e) {
            LOG('pause error', e);
            setErr(String(e?.message ?? e));
        }
    };

    const doStop = async () => {
        LOG('stop');
        try {
            await NextGenMixerBridge.stop();
        } catch (e) {
            LOG('stop error', e);
            setErr(String(e?.message ?? e));
        }
    };

    const doSeek = async (seconds) => {
        LOG('seek', seconds);
        try {
            await NextGenMixerBridge.seek({ seconds });
        } catch (e) {
            LOG('seek error', e);
            setErr(String(e?.message ?? e));
        }
    };

    const doSetVolume = async () => {
        if (!controlId) return;
        LOG('set volume', controlId, volume);
        try {
            await NextGenMixerBridge.setTrackVolume({ id: controlId, volume });
        } catch (e) {
            LOG('set volume error', e);
            setErr(String(e?.message ?? e));
        }
    };

    const doSetMute = async () => {
        if (!controlId) return;
        LOG('set mute', controlId, muted);
        try {
            await NextGenMixerBridge.setTrackMute({ id: controlId, muted });
        } catch (e) {
            LOG('set mute error', e);
            setErr(String(e?.message ?? e));
        }
    };

    const gateBlurb = useMemo(
        () => (
            <div style={{ padding: 24, maxWidth: 520, margin: '48px auto', color: '#e2e8f0', lineHeight: 1.5 }}>
                <h2 style={{ color: '#a78bfa', marginBottom: 12 }}>NextGen engine test</h2>
                <p style={{ marginBottom: 12 }}>
                    This panel is gated so it does not appear in normal use. Add{' '}
                    <code style={{ color: '#fbbf24' }}>?nextgenTest=1</code> to the URL (after the route), or unlock below.
                </p>
                <button
                    type="button"
                    onClick={unlock}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 8,
                        border: '1px solid #7c3aed',
                        background: '#4c1d95',
                        color: '#fff',
                        cursor: 'pointer',
                    }}
                >
                    Unlock test panel (this device)
                </button>
                <p style={{ marginTop: 16, fontSize: 13, opacity: 0.85 }}>
                    Example: <code style={{ color: '#94a3b8' }}>#/nextgen-test?nextgenTest=1</code>
                </p>
                <Link to="/multitrack" style={{ color: '#94a3b8' }}>
                    ← Back to Multitrack
                </Link>
            </div>
        ),
        [unlock],
    );

    if (!isNative) {
        return (
            <div style={{ padding: 24, color: '#e2e8f0', background: '#0f172a', minHeight: '100vh' }}>
                <p>NextGen audio runs on native Android only. Open this route in the Capacitor app.</p>
                <Link to="/multitrack" style={{ color: '#94a3b8' }}>
                    ← Back
                </Link>
            </div>
        );
    }

    if (!flagOk) {
        return (
            <div style={{ background: '#0f172a', minHeight: '100vh' }}>
                {gateBlurb}
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#0f172a',
                color: '#e2e8f0',
                padding: 16,
                fontFamily: 'system-ui, sans-serif',
                fontSize: 14,
            }}
        >
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
                <h1 style={{ fontSize: 18, color: '#c4b5fd', marginBottom: 8 }}>NextGen engine (manual test)</h1>
                <p style={{ opacity: 0.85, marginBottom: 16, fontSize: 13 }}>
                    Isolated from production Multitrack. Uses <code>NextGenMixerBridge</code> only.
                </p>

                {err ? (
                    <div style={{ background: '#450a0a', color: '#fecaca', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                        {err}
                    </div>
                ) : null}

                <section style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 15, color: '#94a3b8', marginBottom: 8 }}>Load session</h2>
                    <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                        Use absolute paths the native decoder can open (from app Data via helper, or paste JSON).
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <input
                            value={songId}
                            onChange={(e) => setSongId(e.target.value)}
                            placeholder="songId (e.g. mysong_123)"
                            style={{ flex: 1, minWidth: 160, padding: 8, borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                        />
                        <input
                            value={stemsCsv}
                            onChange={(e) => setStemsCsv(e.target.value)}
                            placeholder="stem names, comma-separated"
                            style={{ flex: 2, minWidth: 200, padding: 8, borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                        />
                        <select
                            value={ext}
                            onChange={(e) => setExt(e.target.value)}
                            style={{ padding: 8, borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                        >
                            <option value="flac">flac</option>
                            <option value="mp3">mp3</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => void loadFromAppDataPattern()}
                            style={{ padding: '8px 12px', borderRadius: 6, background: '#5b21b6', color: '#fff', border: 'none', cursor: 'pointer' }}
                        >
                            Load from app Data
                        </button>
                    </div>
                    <textarea
                        value={sessionJson}
                        onChange={(e) => setSessionJson(e.target.value)}
                        rows={10}
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: 10,
                            borderRadius: 8,
                            border: '1px solid #334155',
                            background: '#1e293b',
                            color: '#e2e8f0',
                            fontFamily: 'monospace',
                            fontSize: 12,
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => void loadFromJson()}
                        style={{
                            marginTop: 8,
                            padding: '10px 16px',
                            borderRadius: 8,
                            background: '#6d28d9',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        Load session (JSON above)
                    </button>
                </section>

                <section style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button type="button" onClick={() => void doPlay()} style={btn()}>Play</button>
                    <button type="button" onClick={() => void doPause()} style={btn()}>Pause</button>
                    <button type="button" onClick={() => void doStop()} style={btn()}>Stop</button>
                    <button type="button" onClick={() => void doSeek(30)} style={btn()}>Seek 30s</button>
                </section>

                <section style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 15, color: '#94a3b8', marginBottom: 8 }}>Per-track</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <select
                            value={controlId}
                            onChange={(e) => setControlId(e.target.value)}
                            style={{ padding: 8, borderRadius: 6, border: '1px solid #334155', background: '#1e293b', color: '#fff' }}
                        >
                            {loadedIds.length === 0 ? (
                                <option value="">(load session first)</option>
                            ) : (
                                loadedIds.map((id) => (
                                    <option key={id} value={id}>{id}</option>
                                ))
                            )}
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            vol
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={volume}
                                onChange={(e) => setVolume(Number(e.target.value))}
                            />
                            <span style={{ width: 36 }}>{volume.toFixed(2)}</span>
                        </label>
                        <button type="button" onClick={() => void doSetVolume()} style={btn()}>Apply volume</button>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
                            mute
                        </label>
                        <button type="button" onClick={() => void doSetMute()} style={btn()}>Apply mute</button>
                    </div>
                    {loadedIds.length === 0 ? (
                        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Load a session to populate track ids.</p>
                    ) : null}
                </section>

                <section style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 15, color: '#94a3b8', marginBottom: 8 }}>Snapshot</h2>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => void runSnapshot()} style={btn()}>Get snapshot</button>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="checkbox" checked={poll} onChange={(e) => setPoll(e.target.checked)} />
                            Poll every 2s
                        </label>
                    </div>
                    <pre
                        style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            padding: 12,
                            borderRadius: 8,
                            background: '#1e293b',
                            border: '1px solid #334155',
                            fontSize: 11,
                            maxHeight: 240,
                            overflow: 'auto',
                        }}
                    >
                        {snapshotText || '(no snapshot yet)'}
                    </pre>
                </section>

                <Link to="/multitrack" style={{ color: '#94a3b8', fontSize: 13 }}>
                    ← Back to Multitrack
                </Link>
            </div>
        </div>
    );
}

function btn() {
    return {
        padding: '8px 14px',
        borderRadius: 6,
        background: '#4338ca',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
    };
}
