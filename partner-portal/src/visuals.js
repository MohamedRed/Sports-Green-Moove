import { escape, icon, status } from './ui.js';

export function flowPreview(flow) {
  const first = flow.tour?.[0];
  const file = first?.image || first?.clip || flow.images[0]?.file || flow.clips?.[0];
  return file ? `<span class="flow-preview"><img src="media/${file}.jpg" alt="" loading="lazy"></span>`
    : '<span class="flow-preview no-preview">À venir</span>';
}

export function visualOverview(data) {
  return `<section class="visual-overview" aria-labelledby="visual-title">
    <div class="section-heading"><h2 id="visual-title">Explorez l’app, étape par étape</h2></div>
    <p class="visual-intro">Parcourez les captures et les vidéos des essais. Chaque visite explique les actions et leurs résultats.</p>
    <div class="tour-grid">${data.featuredTours.map((id) => {
      const flow = data.flows.find((item) => item.id === id);
      return `<button type="button" class="tour-card" data-flow="${flow.id}" data-tour="true">
        ${flowPreview(flow)}<span class="tour-card-copy">${status(flow.status)}<strong>${escape(flow.title)}</strong>
        <span>${flow.tour.length} étapes ${icon('arrow-up-right')}</span></span></button>`;
    }).join('')}</div></section>`;
}
