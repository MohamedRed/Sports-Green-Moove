import assert from 'node:assert/strict';
import {accessSync, constants, statSync} from 'node:fs';
import {delimiter, isAbsolute, resolve} from 'node:path';

export function localJavaEnvironment(inherited) {
  const env = {...inherited};
  if (!Object.hasOwn(env, 'JAVA_HOME')) return env;
  assert(typeof env.JAVA_HOME === 'string' && isAbsolute(env.JAVA_HOME), 'Configured JAVA_HOME must be an absolute directory');
  const bin = resolve(env.JAVA_HOME, 'bin'), java = resolve(bin, 'java');
  try {
    assert(statSync(java).isFile());
    accessSync(java, constants.X_OK);
  } catch { throw new Error('Configured JAVA_HOME must contain an executable bin/java'); }
  const paths = typeof env.PATH === 'string' && env.PATH.length ? env.PATH.split(delimiter) : [];
  env.PATH = [bin, ...paths.filter(path => path !== bin)].join(delimiter);
  return env;
}
