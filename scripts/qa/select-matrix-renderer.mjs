import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function matrixRendererConfiguration(mode) {
  assert(['software', 'swiftshader'].includes(mode), 'Select exactly one supported matrix renderer');
  return { mode, comparison: mode === 'swiftshader',
    emulatorOptions: `-no-window -gpu ${mode} -no-snapshot -noaudio -no-boot-anim`,
    scope: 'explicit-renderer-selection-not-a-fallback-or-release-acceptance' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const selected = matrixRendererConfiguration(process.env.SGM_MATRIX_RENDERER);
  assert(isAbsolute(process.env.GITHUB_OUTPUT ?? ''), 'Use the runner-owned output file');
  const file = resolve('android/app/build/outputs/matrix-renderer.json');
  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(selected, null, 2) + '\n', { flag: 'wx' });
  appendFileSync(process.env.GITHUB_OUTPUT, `emulator_options=${selected.emulatorOptions}\n`);
  console.log(JSON.stringify(selected));
}
