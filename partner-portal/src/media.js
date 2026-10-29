import { escape, icon, localResults } from './render.js';
import { mediaUrl } from './media-url.js';
import {bindShortVideo, disposeShortVideo} from './short-video.js';

const clipLabels = {
  'support-submission-retry': 'Reprendre une demande · essai local · 10 s',
  'home-to-trips': 'De l’accueil aux trajets · 16 s',
  'parent-guard': 'Restriction du mode conducteur · 15 s',
  'signout-action': 'Déconnexion · 13 s',
  'signed-out-relaunch': 'Relancement en restant déconnecté · 15 s',
};

export function createGallery(flow, initialClip) {
  const images = flow.images.map((item) => ({ type: 'image', file: `${item.file}.jpg`, label: item.alt, landscape: item.landscape === true }));
  const entries = [
    ...(flow.ui ? images : []),
    ...(flow.clips || []).map((id) => ({ type: 'video', file: `${id}.mp4`, poster: `${id}.jpg`, label: clipLabels[id] })),
    ...(!flow.ui ? images : []),
    ...(flow.local ? [{ type: 'checks', label: 'Essai local, sans enregistrement sur téléphone.' }] : []),
  ];
  let index = Math.max(0, entries.findIndex((entry) => entry.file === `${initialClip}.mp4`));
  const container = document.getElementById('media-content');
  const render = () => {
    disposeShortVideo();
    if (!entries.length) {
      container.innerHTML = `<div class="no-media">${icon('image-off')}<h3>Pas encore de vidéo</h3></div>`;
      return;
    }
    const entry = entries[index];
    container.innerHTML = `${entry.type === 'checks' ? localResults(flow) : `<div class="media-stage${entry.landscape ? ' is-landscape' : ''}">${entry.type === 'video'
      ? `<video controls playsinline preload="metadata" poster="${mediaUrl(entry.poster)}" aria-label="${escape(entry.label)}">Votre navigateur ne prend pas en charge la vidéo.</video>`
      : `<a href="${mediaUrl(entry.file)}" target="_blank" rel="noopener" title="Agrandir la capture"><img src="${mediaUrl(entry.file)}" alt="${escape(entry.label)}"></a>`}
      </div>`}${entry.type === 'checks' ? '' : `<p class="media-caption">${escape(entry.label)}</p>`}
      ${entries.length > 1 ? `<div class="media-navigation"><button class="icon-button" id="previous-media" type="button" aria-label="Preuve précédente" title="Preuve précédente" ${index === 0 ? 'disabled' : ''}>${icon('chevron-left')}</button><span>${index + 1} / ${entries.length}</span><button class="icon-button" id="next-media" type="button" aria-label="Preuve suivante" title="Preuve suivante" ${index === entries.length - 1 ? 'disabled' : ''}>${icon('chevron-right')}</button></div>` : ''}
      <div class="media-actions">${entry.type === 'checks' ? '' : `<a class="text-link" download href="${mediaUrl(entry.file)}">${icon('download')}Télécharger</a>`}
      ${flow.recording ? `<a href="${mediaUrl(flow.recording + '-full.mp4')}" target="_blank" rel="noopener">Vidéo longue (${flow.recording === 'navigation' ? '4 min' : '2 min 08'})</a>` : ''}</div>`;
    for (const [selector, delta] of [['#previous-media', -1], ['#next-media', 1]]) {
      const button = container.querySelector(selector);
      if (button) button.onclick = () => { index += delta; render(); };
    }
    const video = container.querySelector('video');
    if (video) bindShortVideo(video, entry.file, container.querySelector('.media-caption'));
  };
  render();
}
