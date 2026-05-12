#!/usr/bin/env node
/**
 * Release escritorio (Windows): opcionalmente sube semver de `desktopVersion`,
 * actualiza `public/app-latest-desktop.json` (sin URL hasta subir),
 * recompila nativo, Vite y genera el .exe.
 *
 * Uso:
 *   npm run release:desktop:auto              → build con la desktopVersion actual (sin subir número)
 *   npm run release:desktop:auto -- --bump  → sube el patch (1.0.0 → 1.0.1) y build
 *   npm run release:desktop:auto -- --minor|--major
 *   npm run release:desktop:auto -- --set 1.2.3
 *
 * La app móvil usa `version`; el .exe y updates usan `desktopVersion`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { semverToVersionCode } from '../src/utils/semverReleaseCompare.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = path.join(root, 'package.json');
const publicJsonPath = path.join(root, 'public', 'app-latest-desktop.json');

function readPkg() {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function writePkg(pkg) {
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

function parseSemver(ver) {
    const m = String(ver || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m) return { major: 1, minor: 0, patch: 0 };
    return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function formatSemver({ major, minor, patch }) {
    return `${major}.${minor}.${patch}`;
}

function bumpSemver(ver, kind) {
    const p = parseSemver(ver);
    if (kind === 'major') {
        p.major += 1;
        p.minor = 0;
        p.patch = 0;
    } else if (kind === 'minor') {
        p.minor += 1;
        p.patch = 0;
    } else {
        p.patch += 1;
    }
    return formatSemver(p);
}

function parseCli() {
    const argv = process.argv.slice(2);
    const out = { bump: false, kind: 'patch', set: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--bump' || a === '-b') out.bump = true;
        else if (a === '--major') {
            out.bump = true;
            out.kind = 'major';
        } else if (a === '--minor') {
            out.bump = true;
            out.kind = 'minor';
        } else if (a === '--patch') {
            out.bump = true;
            out.kind = 'patch';
        } else if (a === '--set' && argv[i + 1]) {
            out.set = argv[++i];
        }
    }
    return out;
}

function runNpm(script) {
    const r = spawnSync('npm', ['run', script], {
        cwd: root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (r.error) throw r.error;
    if (r.status !== 0) process.exit(r.status ?? 1);
}

function runNode(scriptRel) {
    const scriptPath = path.join(root, scriptRel);
    const r = spawnSync(process.execPath, [scriptPath], {
        cwd: root,
        stdio: 'inherit',
        shell: false,
    });
    if (r.error) throw r.error;
    if (r.status !== 0) process.exit(r.status ?? 1);
}

const cli = parseCli();
const pkg = readPkg();
const mobileVersionLocked = String(pkg.version || '').trim();

if (!pkg.desktopVersion || !String(pkg.desktopVersion).trim()) {
    pkg.desktopVersion = '1.0.0';
}

if (cli.set) {
    const s = String(cli.set).trim();
    if (!/^\d+\.\d+\.\d+/.test(s)) {
        console.error('❌ --set requiere semver tipo 1.2.3');
        process.exit(1);
    }
    pkg.desktopVersion = s.replace(/^v/i, '').match(/^[\d.]+/)?.[0] || s;
} else if (cli.bump) {
    pkg.desktopVersion = bumpSemver(pkg.desktopVersion, cli.kind);
}

writePkg(pkg);

const pkgVerify = readPkg();
if (String(pkgVerify.version || '').trim() !== mobileVersionLocked) {
    console.error('❌ Invariante: `package.json` → `version` (app móvil) no debe cambiar en release escritorio. Revisá el script.');
    process.exit(1);
}

const dv = String(pkg.desktopVersion).trim();
const vc = semverToVersionCode(dv);

const appLatest = {
    versionName: dv,
    versionCode: vc,
    desktopDownloadUrl: '',
    releaseNotes:
        'Generado con npm run release:desktop:auto. Subí el .exe (Admin o npm run upload:desktop) y rellenará el enlace.',
    updatedAt: new Date().toISOString(),
};
fs.mkdirSync(path.dirname(publicJsonPath), { recursive: true });
fs.writeFileSync(publicJsonPath, `${JSON.stringify(appLatest, null, 2)}\n`, 'utf8');

console.log('\n🖥️  Zion Stage — release escritorio (solo Windows .exe)');
console.log('   ⛔ Este script NO ejecuta build:android, NO toca android/ ni genera APK.');
console.log(`   📱 package.json version (móvil/web), sin tocar: ${mobileVersionLocked}`);
console.log(`   desktopVersion (escritorio): ${dv}  (código ${vc})`);
console.log(`   ${cli.bump || cli.set ? 'Versión escritorio actualizada en package.json.' : 'Sin bump: misma desktopVersion.'}`);
console.log(`   Escrito: public/app-latest-desktop.json\n`);

runNpm('rebuild:native');
runNpm('build');
runNode('scripts/run-electron-builder-win.mjs');

console.log(`\n✅ Listo. Instalador: desktop-release/ZionStage-Desktop-${dv}-Setup.exe`);
console.log('   Siguiente: npm run upload:desktop  o  Admin → Subir .exe\n');
