import type { MembershipDecision, MembershipReviewGateway, ReviewClub, ReviewMembership } from "./membershipReviewTypes";

type State = {
  clubs: ReviewClub[]; clubsLoaded: boolean; nextClubs: string | null;
  clubId: string; items: ReviewMembership[]; loaded: boolean; nextItems: string | null;
  busy: boolean; error: string | null; notice: string | null; requiresReload: boolean;
};
const initial = (): State => ({ clubs: [], clubsLoaded: false, nextClubs: null, clubId: "", items: [],
  loaded: false, nextItems: null, busy: false, error: null, notice: null, requiresReload: false });

export class MembershipReviewController {
  private state = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private closed = false;
  constructor(private readonly gateway: MembershipReviewGateway) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  private current(ticket: number) { return !this.closed && this.generation === ticket; }
  start() { this.closed = false; void this.loadClubs(); }

  async loadClubs(more = false) {
    if (this.closed || this.state.busy || more && !this.state.nextClubs) return;
    const cursor = more ? this.state.nextClubs! : undefined;
    const ticket = ++this.generation;
    this.set({ busy: true, error: null });
    try {
      const page = await this.gateway.clubs(cursor);
      if (!this.current(ticket)) return;
      if (cursor && page.nextCursor === cursor) throw new Error("La liste n'a pas avancé.");
      const clubs = more ? [...this.state.clubs, ...page.items] : page.items;
      this.set({ clubs: [...new Map(clubs.map((club) => [club.id, club])).values()], nextClubs: page.nextCursor, clubsLoaded: true });
    } catch { if (this.current(ticket)) this.set({ error: "Impossible de charger les clubs. Réessayez." }); }
    finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  async select(clubId: string) {
    if (this.closed || this.state.busy || !this.state.clubs.some((club) => club.id === clubId)) return;
    this.set({ clubId, items: [], loaded: false, nextItems: null, error: null, notice: null, requiresReload: false });
    await this.reload();
  }
  async reload(more = false) {
    if (this.closed || this.state.busy || !this.state.clubId || more && (!this.state.nextItems || this.state.requiresReload)) return;
    const cursor = more ? this.state.nextItems! : undefined;
    const ticket = ++this.generation;
    this.set({ busy: true, error: null, notice: null, ...(more ? {} : { items: [], loaded: false, nextItems: null }) });
    try {
      const page = await this.gateway.members(this.state.clubId, cursor);
      if (!this.current(ticket)) return;
      if (cursor && page.nextCursor === cursor) throw new Error("La liste n'a pas avancé.");
      const items = more ? [...this.state.items, ...page.items] : page.items;
      this.set({ items: [...new Map(items.map((item) => [item.id, item])).values()], nextItems: page.nextCursor,
        loaded: true, requiresReload: false });
    } catch { if (this.current(ticket)) this.set({ error: "Impossible de charger les adhésions. Actualisez avant de décider.", requiresReload: true }); }
    finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  async decide(item: ReviewMembership, decision: MembershipDecision) {
    if (this.closed || this.state.busy) return;
    if (this.state.requiresReload || !this.state.items.includes(item) || !item.allowedActions.includes(decision)) {
      this.set({ error: "Actualisez les adhésions avant de décider." }); return;
    }
    const ticket = ++this.generation;
    let acknowledged = false;
    this.set({ busy: true, error: null, notice: null });
    try {
      await this.gateway.decide(item, decision);
      if (!this.current(ticket)) return;
      acknowledged = true;
      const notice = decision === "approve" ? "Adhésion acceptée." : "Adhésion refusée.";
      this.set({ items: [], loaded: false, nextItems: null, notice });
      const page = await this.gateway.members(this.state.clubId);
      if (this.current(ticket)) this.set({ items: page.items, nextItems: page.nextCursor, loaded: true });
    } catch {
      if (this.current(ticket)) this.set({ requiresReload: true, error: acknowledged
        ? "Décision enregistrée. Actualisez pour revoir les adhésions."
        : "Décision non confirmée. Actualisez avant de réessayer." });
    } finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  close() { this.closed = true; ++this.generation; this.set(initial()); this.listeners.clear(); }
}
