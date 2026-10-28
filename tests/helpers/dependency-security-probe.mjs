import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

const require = createRequire(import.meta.url), {mode, variant, size} = JSON.parse(readFileSync(0, 'utf8'));
const postcssRequire = createRequire(require.resolve('postcss'));
let result;
if (mode === 'multipart') {
  assert(['root', 'cli'].includes(variant)); assert(['field', 'filename'].includes(size));
  const from = variant === 'cli' ? createRequire(require.resolve('firebase-tools/package.json')) : require;
  const FormData = from('form-data'), form = new FormData();
  const malicious = 'synthetic"\r\nX-SGM-Injected: yes\r\nextra="';
  if (size === 'field') form.append(malicious, 'synthetic-value');
  else form.append('safe-field', Buffer.from('synthetic-value'), {filename: malicious});
  const body = form.getBuffer().toString('utf8');
  result = {injectedHeader: body.includes('\r\nX-SGM-Injected: yes\r\n'), valuePreserved: body.includes('synthetic-value')};
} else if (mode === 'id') {
  assert(['secure', 'nonsecure', 'customRandom'].includes(variant)); assert([0, -1, 8].includes(size));
  const library = postcssRequire(variant === 'nonsecure' ? 'nanoid/non-secure' : 'nanoid');
  const generator = variant === 'customRandom' ? library.customRandom('abc', 8, count => new Uint8Array(count)) : library.customAlphabet('abc', 8);
  const value = generator(size); result = {length: value.length, validAlphabet: /^[abc]*$/.test(value)};
} else if (mode === 'source-offset') {
  assert(['normal', 'large', 'fractional', 'nested'].includes(variant));
  const {SourceMapConsumer} = postcssRequire('source-map-js');
  const flat = {version: 3, sources: ['synthetic.js'], names: [], mappings: 'AAAA'};
  const indexed = (line, map) => ({version: 3, sections: [{offset: {line, column: 0}, map}]});
  const map = variant === 'nested' ? indexed(6_000_000, indexed(6_000_000, flat)) :
    indexed(variant === 'large' ? 1_000_000_000 : variant === 'fractional' ? 0.5 : 0, flat);
  try {new SourceMapConsumer(map); result = {rejected: false};}
  catch (error) {result = {rejected: true, expectedError: /Section offset/.test(error.message)};}
} else if (mode === 'source-map-read') {
  const folder = mkdtempSync(resolve(tmpdir(), 'sgm-synthetic-map-'));
  try {
    const path = resolve(folder, 'synthetic.map'), marker = 'SGM_SYNTHETIC_NOT_A_REAL_SECRET';
    writeFileSync(path, JSON.stringify({version: 3, sources: ['private.css'], sourcesContent: [marker], names: [], mappings: 'AAAA'}), {mode: 0o600});
    const postcss = require('postcss');
    const css = 'a { color: red }\n/*# sourceMappingURL=' + path + ' */';
    const output = postcss([]).process(css, {map: {inline: false, annotation: false}});
    result = {cssPreserved: output.css.includes('color: red'), syntheticFileExposed: JSON.stringify(output.map.toJSON()).includes(marker)};
  } finally {rmSync(folder, {recursive: true, force: true});}
} else throw new Error('Unknown isolated dependency probe');
console.log(JSON.stringify(result));
