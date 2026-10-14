import { overview, flowRows, nextSteps, detail, date } from './render.js';
import { createGallery } from './media.js';

let data;
let selectedClip;
let dialogFlow;
const dialog = document.getElementById('flow-dialog');
const query = document.getElementById('query');
const filter = document.getElementById('status');
const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');

function filterFlows() {
  const value = normalize(query.value.trim());
  const flows = data.flows.filter((f) => (filter.value === 'all' || f.status === filter.value)
    && normalize(`${f.title} ${f.summary}`).includes(value));
  document.getElementById('flow-list').innerHTML = flowRows(flows);
  document.getElementById('flow-count').textContent = `${flows.length} / ${data.flows.length} parcours`;
}

function route() {
  if (!data) return;
  const [view = 'apercu', flowId] = location.hash.slice(1).split('/');
  const current = ['apercu', 'parcours', 'suite'].includes(view) ? view : 'apercu';
  document.querySelectorAll('.view').forEach((section) => { section.hidden = section.id !== `view-${current}`; });
  document.querySelectorAll('[data-view]').forEach((tab) => {
    if (tab.dataset.view === current) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  const flow = view === 'parcours' && flowId ? data.flows.find((f) => f.id === flowId) : null;
  if (flow) {
    if (dialogFlow !== flow.id || selectedClip) {
      dialog.querySelector('video')?.pause();
      document.getElementById('flow-detail').innerHTML = detail(flow);
      createGallery(flow, selectedClip);
      selectedClip = undefined;
      dialogFlow = flow.id;
    }
    if (!dialog.open) dialog.showModal();
  } else if (dialog.open) {
    const lastFlow = dialogFlow;
    dialogFlow = undefined;
    dialog.close();
    document.querySelector(`#flow-list [data-flow="${lastFlow}"]`)?.focus({ preventScroll: true });
  }
}

async function load() {
  document.getElementById('loading').hidden = false;
  document.getElementById('load-error').hidden = true;
  try {
    const response = await fetch('data.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Content unavailable');
    data = await response.json();
    document.getElementById('view-apercu').innerHTML = overview(data);
    document.getElementById('view-suite').innerHTML = nextSteps(data);
    document.getElementById('freshness').textContent = `Suivi mis à jour le ${date(data.updatedAt)}. Dernier test : ${date(data.lastVerifiedAt)}.`;
    document.getElementById('footer').innerHTML = `<p>${data.platform}</p><p>Ce suivi décrit les preuves disponibles, pas une validation globale de lancement. Les dates de test restent attachées aux résultats, même lorsque le site est mis à jour.</p>`;
    filterFlows();
    route();
  } catch {
    document.getElementById('load-error').hidden = false;
  } finally {
    document.getElementById('loading').hidden = true;
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-flow]');
  if (!target) return;
  selectedClip = target.dataset.clip;
  const next = `#parcours/${target.dataset.flow}`;
  if (location.hash === next) route();
  else location.hash = next;
});
document.getElementById('close-detail').onclick = () => { location.hash = '#parcours'; };
dialog.addEventListener('cancel', (event) => { event.preventDefault(); location.hash = '#parcours'; });
dialog.addEventListener('close', () => { dialog.querySelector('video')?.pause(); });
document.getElementById('filters').onsubmit = (event) => event.preventDefault();
query.addEventListener('input', filterFlows);
filter.addEventListener('change', filterFlows);
document.getElementById('retry').onclick = load;
window.addEventListener('hashchange', route);
load();
