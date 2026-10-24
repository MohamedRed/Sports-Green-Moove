export const statuses = { verified: 'Testé', partial: 'Test partiel', blocked: 'Bloqué', untested: 'À tester', deferred: 'Plus tard' };
export const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
export const date = (value) => new Intl.DateTimeFormat('fr-BE', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${value}T12:00:00Z`));
export const icon = (name) => `<img src="icons/${name}.svg" alt="" width="18" height="18">`;
export const status = (value) => `<span class="status ${escape(value)}">${escape(statuses[value])}</span>`;
