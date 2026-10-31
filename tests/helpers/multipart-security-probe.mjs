import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const runtimeRequire = createRequire(input.adminEntry);
const Busboy = runtimeRequire('@fastify/busboy');
const result = { fields: [], files: [], parts: [] };
let completed = false;
function finish(error) {
  if (completed) return;
  completed = true;
  clearTimeout(timer);
  if (error) result.error = { name: error.name, message: error.message };
  process.stdout.write(JSON.stringify(result));
}
const timer = setTimeout(() => finish(new Error('Multipart stream did not finish')), 2000);
try {
  const parser = input.mode === 'dicer'
    ? new Busboy.Dicer({ boundary: input.boundary })
    : new Busboy({ headers: { 'content-type': `multipart/form-data; boundary=${input.boundary}` } });
  parser.on('field', (name, value) => result.fields.push({ name, value }));
  parser.on('file', (name, stream, filename) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', finish);
    stream.on('end', () => result.files.push({ name, filename, body: Buffer.concat(chunks).toString() }));
  });
  parser.on('part', stream => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', finish);
    stream.on('end', () => result.parts.push(Buffer.concat(chunks).toString()));
  });
  parser.on('error', finish);
  parser.on('finish', () => finish());
  parser.end(Buffer.from(input.body));
} catch (error) { finish(error); }
