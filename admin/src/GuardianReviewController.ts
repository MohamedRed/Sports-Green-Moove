import type { ReviewClub } from "./membershipReviewTypes";
import type { GuardianDecision, GuardianReview, GuardianReviewGateway } from "./guardianReviewTypes";
import { guardianStatusLabels } from "./guardianReviewTypes";

type State = {
  clubs: ReviewClub[]; clubsLoaded: boolean; nextClubs: string | null;
  clubId: string; items: GuardianReview[]; loaded: boolean; nextItems: string | null;
  busy: boolean; error: string | null; notice: string | null; requiresReload: boolean;
};
const initial = (): State => ({ clubs: [], clubsLoaded: false, nextClubs: null, clubId: "", items: [],
  loaded: false, nextItems: null, busy: false, error: null, notice: null, requiresReload: false });

export class GuardianReviewController {
  private state = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private closed = false;
  constructor(private readonly gateway: GuardianReviewGateway, private readonly operationId = () => crypto.randomUUID()) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  private current(ticket: number) { return !this.closed && this.generation === ticket; }
  start() { this.closed = false; void this.loadClubs(); }

  async loadClubs(more = false) {
    if (this.closed || this.state.busy || more && !this.state.nextClubs) return;
    const cursor = more ? this.state.nextClubs! : undefined, ticket = ++this.generation;
    this.set({ busy: true, error: null, ...(more ? {} : { clubs: [], clubsLoaded: false,
      clubId: "", items: [], loaded: false, nextItems: null, nextClubs: null, notice: null, requiresReload: false }) });
    try {
      const page = await this.gateway.clubs(cursor);
      if (!this.current(ticket)) return;
      if (cursor && page.nextCursor === cursor) throw new Error("La liste n'a pas avancé.");
      const clubs = more ? [...this.state.clubs, ...page.items] : page.items;
      this.set({ clubs: [...new Map(clubs.map((club) => [club.id, club])).values()], nextClubs: page.nextCursor, clubsLoaded: true });
    } catch { if (this.current(ticket)) this.set({ error: "Impossible de charger les clubs. Réessayez.",
      items: [], loaded: false, nextItems: null, requiresReload: true }); }
    finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  async select(clubId: string) {
    if (this.closed || this.state.busy || !this.state.clubs.some((club) => club.id === clubId)) return;
    this.set({ clubId, items: [], loaded: false, nextItems: null, error: null, notice: null, requiresReload: false });
    await this.reload();
  }
  async reload(more = false) {
    if (this.closed || this.state.busy || !this.state.clubId || more && (!this.state.nextItems || this.state.requiresReload)) return;
    const cursor = more ? this.state.nextItems! : undefined, ticket = ++this.generation;
    this.set({ busy: true, error: null, notice: null, ...(more ? {} : { items: [], loaded: false, nextItems: null }) });
    try {
      const page = await this.gateway.requests(this.state.clubId, cursor);
      if (!this.current(ticket)) return;
      if (cursor && page.nextCursor === cursor) throw new Error("La liste n'a pas avancé.");
      const items = more ? [...this.state.items, ...page.items] : page.items;
      this.set({ items: [...new Map(items.map((item) => [item.id, item])).values()], nextItems: page.nextCursor,
        loaded: true, requiresReload: false });
    } catch { if (this.current(ticket)) this.set({ error: "Impossible de charger les demandes. Actualisez avant de décider.",
      items: [], loaded: false, nextItems: null, requiresReload: true }); }
    finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  async decide(item: GuardianReview, action: GuardianDecision) {
    if (this.closed || this.state.busy) return;
    if (this.state.requiresReload || !this.state.items.includes(item) || item.clubId !== this.state.clubId ||
        !item.allowedActions.includes(action) || action === "verify" && (!item.parentName || !item.childName)) {
      this.set({ error: "Actualisez les demandes avant de décider." }); return;
    }
    const ticket = ++this.generation;
    let acknowledged = false;
    this.set({ busy: true, error: null, notice: null });
    try {
      const status = await this.gateway.decide(item, { clubId: item.clubId, childId: item.childId,
        parentUserId: item.parentUserId, action, expectedRevision: item.revision, requestId: this.operationId() });
      if (!this.current(ticket)) return;
      acknowledged = true;
      this.set({ items: [], loaded: false, nextItems: null, notice: `État actuel : ${guardianStatusLabels[status]}.` });
      const page = await this.gateway.requests(this.state.clubId);
      if (this.current(ticket)) this.set({ items: page.items, nextItems: page.nextCursor, loaded: true });
    } catch {
      if (this.current(ticket)) this.set({ items: [], loaded: false, nextItems: null, requiresReload: true, error: acknowledged
        ? "Décision enregistrée. Actualisez pour revoir les demandes."
        : "Décision non confirmée. Actualisez avant de réessayer." });
    } finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  close() { this.closed = true; ++this.generation; this.set(initial()); this.listeners.clear(); }
}
