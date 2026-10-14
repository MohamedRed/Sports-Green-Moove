export const statuses = {
  verified: 'Vérifié', partial: 'Partiellement vérifié', blocked: 'Bloqué',
  untested: 'À tester', deferred: 'Reporté',
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
    <p class="release-note">${icon('info')}${escape(data.releaseNote)}</p>
    <div class="summary" aria-label="État des parcours documentés">
      <div><strong>${verified}</strong><span>parcours vérifiés</span></div>
      <div><strong>${partial}</strong><span>partiellement vérifiés</span></div>
      <div><strong>${remaining}</strong><span>bloqués, à tester ou reportés</span></div>
    </div>
    <div class="section-heading"><h2>À voir en quelques secondes</h2>${link('parcours', 'Tous les parcours')}</div>
    <div class="demos">
      ${demo('signout', 'signout-action', 'Déconnexion corrigée', 'Retour à la connexion, sans quitter l’application.', '13 s · 13 octobre')}
      ${demo('navigation', 'home-to-trips', 'De l’accueil aux trajets', 'Navigation avec le compte parent de test.', '16 s · 13 octobre')}
    </div>
    <div class="overview-bottom">
      <section aria-labelledby="recent-title"><h2 id="recent-title">Dernières avancées</h2>
        ${data.updates.map((u) => `<article class="update"><time datetime="${u.date}">${date(u.date)}</time><h3>${escape(u.title)}</h3><p>${escape(u.text)}</p>${link(`parcours/${u.flow}`, 'Voir le parcours')}</article>`).join('')}
      </section>
      <section class="next-work" aria-labelledby="next-title"><h2 id="next-title">La suite</h2>
        <h3>Débloquer les tests à plusieurs</h3><p>Le staging doit être provisionné avant de tester conducteur, parent et club avec des participants isolés.</p>
        <h3>Corriger les comportements statiques</h3><p>Dates, calendrier, paramètres et états vides ont des limites connues à résoudre.</p>
        <h3>Prouver les trajets et paiements</h3><p>Réservation, suivi actif, sécurité enfant et paiement ne sont pas encore validés de bout en bout.</p>
        ${link('suite', 'Voir les points ouverts')}
      </section>
    </div>`;
}

function demo(id, clip, title, description, duration) {
  return `<button type="button" class="demo" data-flow="${id}" data-clip="${clip}">
    <span class="demo-image"><img src="media/${clip}.jpg" alt="" loading="lazy"><span class="play-icon">${icon('play')}</span></span>
    <span class="demo-copy"><small>${duration}</small><strong>${title}</strong><p>${description}</p></span></button>`;
}

export function flowRows(flows) {
  if (!flows.length) return '<p class="empty-result">Aucun parcours ne correspond à votre recherche.</p>';
  return flows.map((f) => `<button class="flow-row" type="button" data-flow="${f.id}">
    <span><h3>${escape(f.title)}</h3><p>${escape(f.summary)}</p></span>
    <span class="flow-meta">${status(f.status)}${f.checkedAt ? `<time datetime="${f.checkedAt}">Vérifié le ${date(f.checkedAt)}</time>` : '<time>Pas encore vérifié</time>'}</span>
    ${icon('arrow-up-right')}</button>`).join('');
}

export function nextSteps(data) {
  return `<div class="section-heading"><h2>Ce qui reste à résoudre</h2></div>
    <p class="release-note">Ces points empêchent de considérer l’ensemble des parcours comme validé.</p>
    ${data.blockers.map((b) => `<article class="blocker"><div><h3>${escape(b.title)}</h3><p>${escape(b.text)}</p></div><div class="next"><small>Prochaine action</small><p>${escape(b.next)}</p></div></article>`).join('')}
    <section class="tracking-note"><h3>Validation finale sur appareils et audit de sécurité</h3>
      <p>Les captures et vidéos ci-présentes ne remplacent pas les scénarios de trajet actif ni les preuves d’audit requises pour la sortie.</p>
      ${link('parcours/tracking', 'Voir le périmètre restant')}</section>`;
}

export function detail(flow) {
  return `<div class="detail-heading">${status(flow.status)}<h2 id="detail-title">${escape(flow.title)}</h2>
      <p class="date">${flow.checkedAt ? `Dernière vérification : ${date(flow.checkedAt)}` : 'Pas encore vérifié sur ce parcours'}</p>
      <p class="lead">${escape(flow.summary)}</p></div>
    <div class="detail-layout">
    <section class="detail-media" aria-label="Preuves visuelles"><div id="media-content"></div></section>
    <section class="detail-copy">
      <h3>Ce qui est vérifié</h3><p>${escape(flow.verified)}</p>
      <h3>Ce qui reste à prouver</h3><p>${escape(flow.remaining)}</p>
      <p class="source-note">Source : ${flow.source.includes('10-13') ? 'replay BrowserStack du 13 octobre 2026' : flow.source.includes('10-11') ? 'rapport BrowserStack du 11 octobre 2026' : 'dossier de préparation à la sortie'}. Les vidéos sont de nouveaux replays, pas les enregistrements des premières sessions.</p>
    </section></div>`;
}
