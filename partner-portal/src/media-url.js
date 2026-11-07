let revisions;

export function configureMediaRevisions(manifest) {
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object' || !Object.keys(manifest).length)
    throw new Error('Media manifest unavailable');
  const next = new Map();
  for (const [file, hash] of Object.entries(manifest)) {
    if (!/^[a-z0-9-]+\.(jpg|mp4)$/.test(file) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid media manifest');
    next.set(file, hash);
  }
  revisions = next;
}

export function mediaRevision(file) {
  const hash = revisions?.get(file);
  if (!hash) throw new Error('Media revision unavailable');
  return hash;
}

export function mediaUrl(file) {
  return `media/${file}?v=${mediaRevision(file)}`;
}
