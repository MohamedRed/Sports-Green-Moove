import { Badge, TableSection } from "./AdminTable";
import { formatDate, statusTone, textValue } from "./format";
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
      <MembershipsTable memberships={memberships} teams={teams} clubs={clubs} />
    </>
  );
}

function ClubsTable({ clubs, teams, memberships }: ClubOperationsProps) {
  return (
    <TableSection id="clubs" title="Clubs">
      <thead>
        <tr><th>Club</th><th>Region</th><th>Teams</th><th>Members</th><th>Status</th></tr>
      </thead>
      <tbody>{clubs.map((club) => {
        const clubTeams = teams.filter((team) => team.clubId === club.id);
        const clubMemberships = memberships.filter((membership) => membership.clubId === club.id);
        return (
          <tr key={club.id}>
            <td>{textValue(club.name, club.id)}<span>{stringList(club.managerUserIds, "manager ids required")}</span></td>
            <td>{textValue(club.city ?? club.region)}</td>
            <td>{clubTeams.length}</td>
            <td>{clubMemberships.length}</td>
            <td><Badge tone={statusTone(club.status)}>{textValue(club.status, "public")}</Badge></td>
          </tr>
        );
      })}</tbody>
    </TableSection>
  );
}

function stringList(value: unknown, fallback: string): string {
  if (!Array.isArray(value)) return fallback;
  const entries = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return entries.length > 0 ? entries.join(", ") : fallback;
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
        const teamMembers = memberships.filter((membership) => membership.teamId === team.id);
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

function MembershipsTable({ memberships, teams, clubs }: {
  memberships: FirestoreRecord[];
  teams: FirestoreRecord[];
  clubs: FirestoreRecord[];
}) {
  return (
    <TableSection id="memberships" title="Memberships">
      <thead>
        <tr><th>User or child</th><th>Club</th><th>Team</th><th>Role</th><th>Status</th></tr>
      </thead>
      <tbody>{memberships.map((membership) => {
        const club = clubs.find((item) => item.id === membership.clubId);
        const team = teams.find((item) => item.id === membership.teamId);
        return (
          <tr key={membership.id}>
            <td>{textValue(membership.userId ?? membership.childId, membership.id)}<span>{formatDate(membership.updatedAt ?? membership.createdAt)}</span></td>
            <td>{textValue(club?.name, textValue(membership.clubId))}</td>
            <td>{textValue(team?.name, textValue(membership.teamId))}</td>
            <td>{textValue(membership.role, "member")}</td>
            <td><Badge tone={statusTone(membership.status)}>{textValue(membership.status, "active")}</Badge></td>
          </tr>
        );
      })}</tbody>
    </TableSection>
  );
}
