import type { ReviewClub, ReviewPage } from "./membershipReviewTypes";
import { teamStatusLabels, type ReviewTeam, type TeamDecision, type TeamReview, type TeamReviewGateway } from "./teamReviewTypes";

type State = {
  clubs: ReviewClub[]; clubsLoaded: boolean; nextClubs: string | null; clubId: string;
  teams: ReviewTeam[]; teamsLoaded: boolean; nextTeams: string | null; teamId: string; teamName: string | null;
  items: TeamReview[]; loaded: boolean; nextItems: string | null;
  busy: boolean; error: string | null; notice: string | null; requiresReload: boolean;
};
const initial = (): State => ({ clubs: [], clubsLoaded: false, nextClubs: null, clubId: "", teams: [],
  teamsLoaded: false, nextTeams: null, teamId: "", teamName: null, items: [], loaded: false, nextItems: null,
  busy: false, error: null, notice: null, requiresReload: false });
function permissionLost(error: unknown) {
  return error !== null && typeof error === "object" && "code" in error &&
    ["functions/permission-denied", "functions/unauthenticated"].includes(String(error.code));
}
function merge<T extends { id: string }>(previous: T[], page: ReviewPage<T>, cursor: string | undefined, seen: Set<string>) {
  if (cursor) seen.add(cursor);
  if (page.nextCursor && seen.has(page.nextCursor)) throw new Error("La liste n'avance pas.");
  const items = [...previous, ...page.items];
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Liste répétée.");
  return items;
}
export class TeamReviewController {
  private state = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private closed = false;
  private clubCursors = new Set<string>();
  private teamCursors = new Set<string>();
  private itemCursors = new Set<string>();
  constructor(private readonly gateway: TeamReviewGateway, private readonly operationId = () => crypto.randomUUID()) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  private current(ticket: number) { return !this.closed && this.generation === ticket; }
  start() { this.closed = false; void this.loadClubs(); }
  async loadClubs(more = false) {
    if (this.closed || this.state.busy || more && !this.state.nextClubs) return;
    const cursor = more ? this.state.nextClubs! : undefined, ticket = ++this.generation;
    if (!more) this.clubCursors.clear();
    this.set({ ...(more ? {} : initial()), busy: true, error: null });
    try {
      const page = await this.gateway.clubs(cursor); if (!this.current(ticket)) return;
      this.set({ clubs: merge(more ? this.state.clubs : [], page, cursor, this.clubCursors),
        nextClubs: page.nextCursor, clubsLoaded: true });
    } catch { if (this.current(ticket)) this.set({ clubs: [], clubsLoaded: false, nextClubs: null, clubId: "",
      teams: [], teamsLoaded: false, nextTeams: null, teamId: "", teamName: null, items: [], loaded: false, nextItems: null,
      requiresReload: true, error: "Impossible de charger les clubs. Réessayez." }); }
    finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  async selectClub(clubId: string) {
    if (this.closed || this.state.busy || !this.state.clubs.some((club) => club.id === clubId)) return;
    this.set({ clubId }); await this.loadTeams();
  }
  async loadTeams(more = false) {
    if (this.closed || this.state.busy || !this.state.clubId || more && !this.state.nextTeams) return;
    const cursor = more ? this.state.nextTeams! : undefined, ticket = ++this.generation;
    if (!more) this.teamCursors.clear();
    this.set({ busy: true, error: null, notice: null, ...(more ? {} : { teams: [], teamsLoaded: false,
      nextTeams: null, teamId: "", teamName: null, items: [], loaded: false, nextItems: null, requiresReload: false }) });
    try {
      const page = await this.gateway.teams(this.state.clubId, cursor); if (!this.current(ticket)) return;
      const teams = merge(more ? this.state.teams : [], page, cursor, this.teamCursors);
      if (teams.some((team) => team.clubId !== this.state.clubId)) throw new Error("Club différent.");
      this.set({ teams, nextTeams: page.nextCursor, teamsLoaded: true });
    } catch { if (this.current(ticket)) this.set({ teams: [], teamsLoaded: false, nextTeams: null, teamId: "", teamName: null,
      items: [], loaded: false, nextItems: null, requiresReload: true, error: "Impossible de charger les équipes. Actualisez les équipes." }); }
    finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  async selectTeam(teamId: string) {
    if (this.closed || this.state.busy || !this.state.teams.some((team) => team.id === teamId)) return;
    this.set({ teamId, teamName: null }); await this.reload();
  }
  async reload(more = false) {
    const team = this.state.teams.find((item) => item.id === this.state.teamId);
    if (this.closed || this.state.busy || !team || more && (!this.state.nextItems || this.state.requiresReload)) return;
    const cursor = more ? this.state.nextItems! : undefined, ticket = ++this.generation;
    if (!more) this.itemCursors.clear();
    this.set({ busy: true, error: null, notice: null, ...(more ? {} : { items: [], loaded: false, nextItems: null, teamName: null }) });
    try {
      const page = await this.gateway.requests(team, cursor); if (!this.current(ticket)) return;
      this.set({ items: merge(more ? this.state.items : [], page, cursor, this.itemCursors), nextItems: page.nextCursor,
        teamName: page.teamName, loaded: true, requiresReload: false });
    } catch (error) { if (this.current(ticket)) this.set({ items: [], loaded: false, nextItems: null, teamName: null,
      ...(permissionLost(error) ? { teams: [], teamsLoaded: false, nextTeams: null, teamId: "" } : {}),
      requiresReload: true, error: "Impossible de charger les inscriptions. Actualisez ; si l'équipe a changé, actualisez les équipes." }); }
    finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  async decide(item: TeamReview, action: TeamDecision) {
    if (this.closed || this.state.busy) return;
    const team = this.state.teams.find((row) => row.id === this.state.teamId);
    if (!team || this.state.requiresReload || !this.state.items.includes(item) || item.clubId !== this.state.clubId ||
        item.teamId !== team.id || item.teamInstanceId !== team.teamInstanceId || !item.allowedActions.includes(action) ||
        item.revision >= Number.MAX_SAFE_INTEGER || action === "approve" && (!team.open || !this.state.teamName || !item.subjectName)) {
      this.set({ error: "Actualisez les inscriptions avant de décider." }); return;
    }
    const ticket = ++this.generation; let acknowledged = false;
    this.set({ busy: true, error: null, notice: null });
    try {
      const status = await this.gateway.decide(item, { enrollmentId: item.id, action, expectedRevision: item.revision, requestId: this.operationId() });
      if (!this.current(ticket)) return;
      acknowledged = true; this.itemCursors.clear();
      this.set({ items: [], loaded: false, nextItems: null, requiresReload: true, notice: `État actuel : ${teamStatusLabels[status]}.` });
      const page = await this.gateway.requests(team);
      if (this.current(ticket)) this.set({ items: merge([], page, undefined, this.itemCursors), nextItems: page.nextCursor,
        teamName: page.teamName, loaded: true, requiresReload: false });
    } catch (error) { if (this.current(ticket)) this.set({ items: [], loaded: false, nextItems: null, teamName: null, requiresReload: true,
      ...(permissionLost(error) ? { teams: [], teamsLoaded: false, nextTeams: null, teamId: "" } : {}),
      error: acknowledged ? "Décision enregistrée. Actualisez pour revoir les inscriptions." : "Décision non confirmée. Actualisez avant de réessayer." }); }
    finally { if (this.current(ticket)) this.set({ busy: false }); }
  }
  close() { this.closed = true; ++this.generation; this.set(initial()); this.listeners.clear(); }
}
