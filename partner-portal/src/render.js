import { escape, date, icon, status } from './ui.js';
import { flowPreview } from './visuals.js';
export { escape, date, icon, status, statuses } from './ui.js';
const link = (hash, label) => `<a class="text-link" href="#${hash}">${escape(label)}${icon('arrow-up-right')}</a>`;

export function partitionUpdates(updates) {
  const recent = [];
  const previous = [];
  const flows = new Set();
  for (const entry of updates) {
    if (recent.length < 6 && !flows.has(entry.flow)) {
      recent.push(entry);
      flows.add(entry.flow);
    } else {
      previous.push(entry);
    }
  }
  return { recent, previous };
}

export function overview(data) {
  const verified = data.flows.filter((f) => f.status === 'verified').length;
  const partial = data.flows.filter((f) => f.status === 'partial').length;
  const remaining = data.flows.length - verified - partial;
  const { recent, previous } = partitionUpdates(data.updates);
  return `
    <div class="summary" aria-label="État des parcours documentés">
      <div><strong>${verified}</strong><span>testés</span></div>
      <div><strong>${partial}</strong><span>en partie testés</span></div>
      <div><strong>${remaining}</strong><span>en attente</span></div>
    </div>
    <div class="overview-bottom">
      <section aria-labelledby="recent-title"><h2 id="recent-title">Dernières nouvelles</h2>
        ${recent.map(update).join('')}
        ${previous.length ? `<details class="previous-updates"><summary>Voir les nouvelles précédentes</summary>${previous.map(update).join('')}</details>` : ''}
      </section>
    </div>`;
}

function update(u) {
  return `<article class="update"><time datetime="${u.date}">${date(u.date)}</time><h3><a href="#parcours/${u.flow}">${escape(u.title)}</a></h3><p>${escape(u.text)}</p></article>`;
}

export function flowRows(flows) {
  if (!flows.length) return '<p class="empty-result">Aucun parcours ne correspond à votre recherche.</p>';
  return flows.map((f) => `<button class="flow-row" type="button" data-flow="${f.id}"${f.tour ? ' data-tour="true"' : ''}>
    ${flowPreview(f)}<span class="flow-copy"><h3>${escape(f.title)}</h3><p>${escape(f.summary)}</p></span>
    <span class="flow-meta">${status(f.status)}${f.checkedAt ? `<time datetime="${f.checkedAt}">${date(f.checkedAt)}</time>` : ''}</span>
    <span class="flow-action">${f.tour ? `Visite guidée · ${f.tour.length} étapes` : f.images.length || f.clips?.length ? 'Voir les captures' : 'Voir l’avancement'}${icon('arrow-up-right')}</span></button>`).join('');
}

export function nextSteps(data) {
  return `<div class="section-heading"><h2>À faire</h2></div>
    ${data.blockers.map((b) => `<article class="blocker"><div><h3>${escape(b.title)}</h3><p>${escape(b.text)}</p></div><div class="next"><p>${escape(b.next)}</p></div></article>`).join('')}
    <p class="tracking-link">${link('parcours/tracking', 'Tester le suivi pendant un trajet')}</p>`;
}

export function detail(flow) {
  return `<div class="detail-heading">${status(flow.status)}<h2 id="detail-title">${escape(flow.title)}</h2>
      ${flow.checkedAt ? `<p class="date">${flow.latestEvidence === 'phone' ? 'Essai sur téléphone' : flow.latestEvidence === 'local' ? 'Essai local' : flow.phone && (flow.phone.checkedAt ?? flow.checkedAt) === flow.checkedAt ? 'Essai sur téléphone' : flow.local || flow.ui || flow.searchBookingUi ? 'Essai local' : 'Test'} du ${date(flow.checkedAt)}</p>` : ''}</div>
    ${flow.tour ? `<nav class="detail-modes" aria-label="Présentation du parcours"><a href="#parcours/${flow.id}/visite/1">Visite guidée</a><a href="#parcours/${flow.id}">Toutes les preuves</a></nav>` : ''}
    <div class="detail-layout">
    <section class="detail-media" aria-label="Résultats, vidéos et captures"><div id="media-content"></div></section>
    <section class="detail-copy">
      ${flow.local && !flow.ui ? '' : `<h3>Testé</h3><p>${escape(flow.verified)}</p>`}
      <h3>À faire</h3><p>${escape(flow.remaining)}</p>
      ${flow.recording ? `<details class="test-info"><summary>Infos du test</summary><p>Nouvel enregistrement du parcours.${flow.id === 'signout' ? ' Pauses retirées de la vidéo longue.' : ''}</p></details>` : ''}
    </section></div>`;
}

export function localResults(flow) {
  return `<section class="local-results" aria-label="Résultats de l’essai local"><h3>Ce qui a été vérifié</h3>
    ${flow.local.checkedAt ? `<p class="date">Essai local du ${date(flow.local.checkedAt)}</p>` : ''}
    <ul>${flow.local.checks.map((check) => `<li>${escape(check)}</li>`).join('')}</ul></section>`;
}
