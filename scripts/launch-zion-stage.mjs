/**
 * Abre Zion Stage (app JUCE de escritorio) desde la raíz del repo.
 * Uso: npm run zion-stage
 * Antes suele hacer falta `npm start` en otra terminal (proxy :3001).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const candidates = [
  process.env.ZION_STAGE_EXE,
  path.join(root, 'ZionStageDesktop', 'build', 'ZionStage_artefacts', 'Debug', 'Zion Stage.exe'),
  path.join(root, 'ZionStageDesktop', 'build', 'ZionStage_artefacts', 'Release', 'Zion Stage.exe'),
].filter(Boolean);

const exe = candidates.find((p) => fs.existsSync(p));

if (!exe) {
  console.error(
    'No encuentro Zion Stage.exe.\n' +
      'Compila el proyecto CMake en ZionStageDesktop/build (Debug o Release) y vuelve a intentar.\n' +
      'Rutas probadas:\n' +
      candidates.map((p) => '  - ' + p).join('\n')
  );
  process.exit(1);
}

const child = spawn(exe, [], {
  detached: true,
  stdio: 'ignore',
  cwd: path.dirname(exe),
  shell: false,
});
child.unref();

console.log('Zion Stage:', exe);
