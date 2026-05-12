/**
 * Ejecuta electron-builder para Windows usando `desktopVersion` del package.json
 * (versión de escritorio, distinta de `version` / app móvil).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const desktopV = String(pkg.desktopVersion || pkg.version || '0.0.0').trim();

const args = ['electron-builder', '--win', '--x64', '--publish', 'never', `--config.extraMetadata.version=${desktopV}`];
const r = spawnSync('npx', args, { cwd: root, stdio: 'inherit', shell: true });
process.exit(r.status === null ? 1 : r.status);
