import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import type { TeamReviewGateway } from "./teamReviewTypes";
import { reviewTeam, teamDecisionStatus, teamDocumentId, teamPage, teamRecord, teamReviewPage } from "./teamReviewWire";

export function teamReviewGateway(uid: string): TeamReviewGateway {
  async function call(name: string, data: unknown): Promise<unknown> {
    if (!functions || auth?.currentUser?.uid !== uid) throw new Error("Session modifiée. Reconnectez-vous.");
    const result = await httpsCallable(functions, name)(data);
    if (auth.currentUser?.uid !== uid) throw new Error("Session modifiée. Reconnectez-vous.");
    return result.data;
  }
  return {
    async clubs(cursor) {
      return teamPage(await call("listGuardianReviewClubs", cursor ? { cursor } : {}), (row) => {
        if (typeof row.name !== "string" || !row.name.trim()) throw new Error("Club non confirmé.");
        return { id: teamDocumentId(row.id), name: row.name };
      });
    },
    async teams(clubId, cursor) {
      const data = teamRecord(await call("listTeamEnrollmentReviewTeams", { clubId, ...(cursor ? { cursor } : {}) }));
      if (data.clubId !== clubId) throw new Error("Club non confirmé.");
      return teamPage(data, (row) => reviewTeam(row, clubId));
    },
    async requests(team, cursor) {
      return teamReviewPage(await call("listTeamEnrollments", { teamId: team.id, ...(cursor ? { cursor } : {}) }), team);
    },
    async decide(item, operation) { return teamDecisionStatus(await call("transitionTeamEnrollment", operation), item, operation); },
  };
}
