import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {isAbsolute, join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {parseArgs} from 'node:util';

const {values} = parseArgs({options: {'java-home': {type: 'string'}, 'android-jar': {type: 'string'}, 'junit-jar': {type: 'string'}}});
for (const name of ['java-home', 'android-jar', 'junit-jar']) assert(isAbsolute(values[name] ?? '') && existsSync(values[name]), 'Specify existing absolute ' + name);
const root = resolve(import.meta.dirname, '../..'), directory = mkdtempSync(join(tmpdir(), 'sgm-ordinary-case-clock-'));
try {
  const classes = join(directory, 'classes'); mkdirSync(classes);
  const classpath = [values['android-jar'], values['junit-jar']].join(process.platform === 'win32' ? ';' : ':');
  execFileSync(join(values['java-home'], 'bin/javac'), ['--release', '17', '-Xlint:all', '-Werror', '-classpath', classpath,
    '-d', classes, join(root, 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/OrdinaryCaseTimingListener.java'),
    join(root, 'tests/fixtures/ordinary-case-timing/OrdinaryCaseTimingChecks.java')], {stdio: 'pipe', timeout: 60_000});
  const output = execFileSync(join(values['java-home'], 'bin/java'), ['-classpath', [classes, classpath].join(process.platform === 'win32' ? ';' : ':'),
    'be.sportgreenmoove.app.ui.OrdinaryCaseTimingChecks'], {encoding: 'utf8', timeout: 30_000});
  assert(output.includes('no device emission proof')); process.stdout.write(output);
} finally {rmSync(directory, {recursive: true, force: true});}
