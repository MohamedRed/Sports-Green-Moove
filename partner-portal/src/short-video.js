import {mediaRevision, mediaUrl} from './media-url.js';

export const MAX_SHORT_CLIP_BYTES = 240000;
let clips;
let active;

export function configureShortClips(manifest) {
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object' || !Object.keys(manifest).length)
    throw new Error('Short clip manifest unavailable');
  const next = new Map();
  for (const [file, bytes] of Object.entries(manifest)) {
    if (!/^[a-z0-9-]+\.mp4$/.test(file) || file.endsWith('-full.mp4') || !Number.isSafeInteger(bytes)
      || bytes < 1 || bytes > MAX_SHORT_CLIP_BYTES) throw new Error('Invalid short clip manifest');
    mediaRevision(file);
    next.set(file, bytes);
  }
  clips = next;
}

export async function loadVerifiedShortClip(file, signal, {
  fetcher = globalThis.fetch,
  digest = bytes => globalThis.crypto.subtle.digest('SHA-256', bytes),
} = {}) {
  const size = clips?.get(file);
  if (!size) throw new Error('Unapproved short clip');
  const expected = mediaRevision(file);
  signal.throwIfAborted();
  const response = await fetcher(mediaUrl(file), {signal, cache: 'force-cache', credentials: 'same-origin', redirect: 'error'});
  const reject = async message => {
    try {await response.body?.cancel();} catch { /* Preserve the response validation failure. */ }
    throw new Error(message);
  };
  if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'video/mp4')
    return reject('Short clip response rejected');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^[1-9]\d*$/.test(length) || Number(length) !== size))
    return reject('Short clip size mismatch');
  if (!response.body) throw new Error('Short clip body unavailable');
  const reader = response.body.getReader();
  const bytes = new Uint8Array(size);
  let offset = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const part = await reader.read();
      if (part.done) break;
      if (!(part.value instanceof Uint8Array) || offset + part.value.byteLength > size)
        throw new Error('Short clip exceeds approved size');
      bytes.set(part.value, offset); offset += part.value.byteLength;
    }
    if (offset !== size) throw new Error('Short clip is incomplete');
  } catch (error) {
    try {await reader.cancel();} catch { /* Keep the original fetch or size failure. */ }
    throw error;
  } finally {reader.releaseLock();}
  signal.throwIfAborted();
  const hash = [...new Uint8Array(await digest(bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  signal.throwIfAborted();
  if (hash !== expected) throw new Error('Short clip revision mismatch');
  return new Blob([bytes], {type: 'video/mp4'});
}

export function currentShortClip() {return active?.file;}
export function disposeShortVideo() {active?.dispose();}

export function bindShortVideo(video, file, caption, {
  load = loadVerifiedShortClip, urls = globalThis.URL,
} = {}) {
  disposeShortVideo();
  const controller = new AbortController();
  const status = video.ownerDocument.createElement('span');
  status.className = 'media-state'; status.setAttribute('role', 'status');
  status.textContent = 'Chargement de la vidéo…'; caption.append(status);
  video.controls = false; video.setAttribute('aria-busy', 'true');
  let objectUrl, disposed = false, failed = false;
  const isCurrent = () => active === binding && !disposed && !controller.signal.aborted;
  function onReady() {
    if (!isCurrent() || failed) return;
    status.textContent = ''; video.controls = true; video.removeAttribute('aria-busy');
  }
  function onError() {
    if (!isCurrent()) return;
    failed = true; video.controls = false; video.removeAttribute('aria-busy');
    status.setAttribute('role', 'alert');
    status.textContent = 'La vidéo ne peut pas être lue. Le téléchargement reste disponible.';
    controller.abort();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; controller.abort(); video.pause();
    video.removeEventListener('loadeddata', onReady); video.removeEventListener('error', onError);
    video.removeAttribute('src'); video.load();
    if (objectUrl) urls.revokeObjectURL(objectUrl);
    status.remove();
    if (active === binding) active = undefined;
  }
  const binding = {file, dispose, ready: undefined}; active = binding;
  video.addEventListener('loadeddata', onReady); video.addEventListener('error', onError);
  binding.ready = (async () => {
    try {
      const blob = await load(file, controller.signal);
      if (!isCurrent()) return false;
      objectUrl = urls.createObjectURL(blob); video.src = objectUrl; video.load();
      return true;
    } catch {
      if (isCurrent()) onError();
      return false;
    }
  })();
  return binding;
}
