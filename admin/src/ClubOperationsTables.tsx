import { Badge, TableSection } from "./AdminTable";
import { statusTone, textValue } from "./format";
import type { FirestoreRecord } from "./types";

type ClubOperationsProps = {
  clubs: FirestoreRecord[];
  teams: FirestoreRecord[];
  memberships: FirestoreRecord[];
};

export function ClubOperationsTables({ clubs, teams, memberships }: ClubOperationsProps) {
  return (
    <>
      <ClubsTable clubs={clubs} teams={teams} memberships={memberships} />
      <TeamsTable teams={teams} clubs={clubs} memberships={memberships} />
    </>
  );
}

function ClubsTable({ clubs, teams }: ClubOperationsProps) {
  return (
    <TableSection id="clubs" title="Clubs">
      <thead>
        <tr><th>Club</th><th>Region</th><th>Teams</th><th>Members</th><th>Status</th></tr>
      </thead>
      <tbody>{clubs.map((club) => {
        const clubTeams = teams.filter((team) => team.clubId === club.id);
        return (
          <tr key={club.id}>
            <td>{textValue(club.name, club.id)}</td>
            <td>{textValue(club.city ?? club.region)}</td>
            <td>{clubTeams.length}</td>
            <td>{typeof club.memberCount === "number" && Number.isSafeInteger(club.memberCount) && club.memberCount >= 0 ? club.memberCount : "Indisponible"}</td>
            <td><Badge tone={statusTone(club.status)}>{textValue(club.status, "public")}</Badge></td>
          </tr>
        );
      })}</tbody>
    </TableSection>
  );
}

function TeamsTable({ teams, clubs, memberships }: {
  teams: FirestoreRecord[];
  clubs: FirestoreRecord[];
  memberships: FirestoreRecord[];
}) {
  return (
    <TableSection id="teams" title="Teams">
      <thead>
        <tr><th>Team</th><th>Club</th><th>Category</th><th>Members</th><th>Status</th></tr>
      </thead>
      <tbody>{teams.map((team) => {
        const club = clubs.find((item) => item.id === team.clubId);
        const teamMembers = memberships.filter((membership) => membership.status === "active" && membership.active !== false &&
          (membership.teamId === team.id || Array.isArray(membership.teamIds) && membership.teamIds.includes(team.id)));
        return (
          <tr key={team.id}>
            <td>{textValue(team.name, team.id)}<span>{textValue(team.season)}</span></td>
            <td>{textValue(club?.name, textValue(team.clubId))}</td>
            <td>{textValue(team.category)}</td>
            <td>{teamMembers.length}</td>
            <td><Badge tone={statusTone(team.status)}>{textValue(team.status, "active")}</Badge></td>
          </tr>
        );
      })}</tbody>
    </TableSection>
  );
}
