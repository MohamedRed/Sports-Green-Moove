export const statuses = {
  verified: 'Testé', partial: 'Test partiel', blocked: 'Bloqué',
  untested: 'À tester', deferred: 'Plus tard',
};

export const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
export const date = (value) => new Intl.DateTimeFormat('fr-BE', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${value}T12:00:00Z`));
export const icon = (name) => `<img src="icons/${name}.svg" alt="" width="18" height="18">`;
export const status = (value) => `<span class="status ${escape(value)}">${escape(statuses[value])}</span>`;
const link = (hash, label) => `<a class="text-link" href="#${hash}">${escape(label)}${icon('arrow-up-right')}</a>`;

export function overview(data) {
  const verified = data.flows.filter((f) => f.status === 'verified').length;
  const partial = data.flows.filter((f) => f.status === 'partial').length;
  const remaining = data.flows.length - verified - partial;
  return `
    <div class="summary" aria-label="État des parcours documentés">
      <div><strong>${verified}</strong><span>testés</span></div>
      <div><strong>${partial}</strong><span>en partie testés</span></div>
      <div><strong>${remaining}</strong><span>en attente</span></div>
    </div>
    <div class="section-heading"><h2>Vidéos</h2>${link('parcours', 'Tous les parcours')}</div>
    <div class="demos">
      ${demo('signout', 'signout-action', 'Déconnexion corrigée', '13 s')}
      ${demo('navigation', 'home-to-trips', 'De l’accueil aux trajets', '16 s')}
    </div>
    <div class="overview-bottom">
      <section aria-labelledby="recent-title"><h2 id="recent-title">Dernières nouvelles</h2>
        ${data.updates.map((u) => `<article class="update"><time datetime="${u.date}">${date(u.date)}</time><h3><a href="#parcours/${u.flow}">${escape(u.title)}</a></h3><p>${escape(u.text)}</p></article>`).join('')}
      </section>
    </div>`;
}

function demo(id, clip, title, duration) {
  return `<button type="button" class="demo" data-flow="${id}" data-clip="${clip}">
    <span class="demo-image"><img src="media/${clip}.jpg" alt="" loading="lazy"><span class="play-icon">${icon('play')}</span></span>
    <span class="demo-copy"><strong>${title}</strong><small>${duration}</small></span></button>`;
}

export function flowRows(flows) {
  if (!flows.length) return '<p class="empty-result">Aucun parcours ne correspond à votre recherche.</p>';
  return flows.map((f) => `<button class="flow-row" type="button" data-flow="${f.id}">
    <span><h3>${escape(f.title)}</h3><p>${escape(f.summary)}</p></span>
    <span class="flow-meta">${status(f.status)}${f.checkedAt ? `<time datetime="${f.checkedAt}">${date(f.checkedAt)}</time>` : ''}</span>
    ${icon('arrow-up-right')}</button>`).join('');
}

export function nextSteps(data) {
  return `<div class="section-heading"><h2>À faire</h2></div>
    ${data.blockers.map((b) => `<article class="blocker"><div><h3>${escape(b.title)}</h3><p>${escape(b.text)}</p></div><div class="next"><p>${escape(b.next)}</p></div></article>`).join('')}
    <p class="tracking-link">${link('parcours/tracking', 'Tester le suivi pendant un trajet')}</p>`;
}

export function detail(flow) {
  return `<div class="detail-heading">${status(flow.status)}<h2 id="detail-title">${escape(flow.title)}</h2>
      ${flow.checkedAt ? `<p class="date">${flow.local || flow.ui ? 'Essai local' : 'Test'} du ${date(flow.checkedAt)}</p>` : ''}</div>
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
    <ul>${flow.local.checks.map((check) => `<li>${escape(check)}</li>`).join('')}</ul></section>`;
}
