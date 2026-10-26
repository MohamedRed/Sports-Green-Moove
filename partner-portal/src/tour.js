import { escape, icon } from './ui.js';
import { mediaUrl } from './media-url.js';

export function createTour(flow, position) {
  const index = Math.min(flow.tour.length - 1, Math.max(0, Number.parseInt(position, 10) - 1 || 0));
  const step = flow.tour[index];
  const image = flow.images.find((item) => item.file === step.image);
  const container = document.getElementById('media-content');
  container.innerHTML = `<div class="tour-progress" role="status">Étape ${index + 1} sur ${flow.tour.length}</div>
    <div class="media-stage${image?.landscape ? ' is-landscape' : ''}">${step.clip
      ? `<video controls playsinline preload="metadata" poster="${mediaUrl(step.clip + '.jpg')}" aria-label="${escape(step.title)}"><source src="${mediaUrl(step.clip + '.mp4')}" type="video/mp4"></video>`
      : `<a href="${mediaUrl(step.image + '.jpg')}" target="_blank" rel="noopener" title="Agrandir la capture"><img src="${mediaUrl(step.image + '.jpg')}" alt="${escape(image.alt)}"></a>`}</div>
    <p class="media-caption">${escape(image?.alt || 'Extrait de l’enregistrement du parcours.')}</p>
    <div class="tour-instruction"><h3 tabindex="-1">${escape(step.title)}</h3><p>${escape(step.text)}</p></div>
    <nav class="tour-navigation" aria-label="Étapes de la visite">
      ${index ? `<a class="tour-previous" href="#parcours/${flow.id}/visite/${index}">${icon('chevron-left')}Précédent</a>` : '<span></span>'}
      ${index + 1 < flow.tour.length ? `<a class="tour-next" href="#parcours/${flow.id}/visite/${index + 2}">Suivant${icon('chevron-right')}</a>`
        : `<a class="tour-next" href="#parcours/${flow.id}">Voir toutes les preuves${icon('arrow-up-right')}</a>`}
    </nav>`;
  if (index) container.querySelector('.tour-instruction h3').focus({ preventScroll: true });
}
