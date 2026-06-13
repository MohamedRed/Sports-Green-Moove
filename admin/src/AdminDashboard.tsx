import { useState } from "react";
import { emptyRoles, issueRewardPayout, setUserRoles } from "./actions";
import { Badge, TableSection } from "./AdminTable";
import { ClubOperationsTables } from "./ClubOperationsTables";
import { formatDate, formatEuro, numberValue, statusTone, textValue } from "./format";
import { ReportsTable } from "./ReportsTable";
import { useCollection, usePayoutCandidates } from "./useCollections";
import { Wordmark } from "./App";
import type { FirestoreRecord, Metric, PayoutCandidate, RoleMap } from "./types";

type Props = {
  userEmail: string;
  projectLabel: string;
  onSignOut: () => void;
};

export function AdminDashboard({ userEmail, projectLabel, onSignOut }: Props) {
  const users = useCollection("users");
  const clubs = useCollection("clubs");
  const teams = useCollection("teams");
  const memberships = useCollection("memberships", 200);
  const trips = useCollection("trips");
  const bookings = useCollection("bookings");
  const rideSessions = useCollection("rideSessions");
  const reports = useCollection("reports");
  const ledger = useCollection("rewardLedger", 200);
  const stripeAccounts = useCollection("stripeAccounts");
  const payouts = usePayoutCandidates(ledger.items, stripeAccounts.items);
  const metrics = buildMetrics({ bookings: bookings.items, ledger: ledger.items, reports: reports.items, rideSessions: rideSessions.items });

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Admin navigation">
        <Wordmark />
        <nav>
          {["Overview", "Users", "Clubs", "Teams", "Memberships", "Trips", "Ride sessions", "Reports", "Payouts"].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`}>{item}</a>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Firebase project</p>
            <h1>Public launch operations</h1>
            <span className="muted">{userEmail}</span>
          </div>
          <div className="topbar-actions">
            <span className="project-pill">{projectLabel}</span>
            <button className="secondary-button" onClick={onSignOut}>Sortir</button>
          </div>
        </header>

        <section className="metric-grid" id="overview" aria-label="Launch metrics">
          {metrics.map((metric) => <MetricCard metric={metric} key={metric.label} />)}
        </section>

        <DataWarning states={[users, clubs, teams, memberships, trips, bookings, rideSessions, reports, ledger, stripeAccounts]} />
        <UsersTable users={users.items} />
        <ClubOperationsTables clubs={clubs.items} teams={teams.items} memberships={memberships.items} />
        <TripsTable trips={trips.items} bookings={bookings.items} />
        <RideSessionsTable rideSessions={rideSessions.items} />
        <ReportsTable reports={reports.items} />
        <PayoutsTable payouts={payouts} />
      </section>
    </main>
  );
}

function buildMetrics(data: {
  bookings: FirestoreRecord[];
  ledger: FirestoreRecord[];
  reports: FirestoreRecord[];
  rideSessions: FirestoreRecord[];
}): Metric[] {
  const activeRides = data.rideSessions.filter((item) => item.status === "active").length;
  const pendingBookings = data.bookings.filter((item) => item.status === "requested").length;
  const openReports = data.reports.filter((item) => item.status === "open").length;
  const payoutCents = data.ledger.reduce((total, entry) => total + numberValue(entry.amountCents), 0);
  return [
    { label: "Active ride sessions", value: String(activeRides), trend: "Radar, fallback and manual statuses" },
    { label: "Bookings pending", value: String(pendingBookings), trend: "Driver approval queue" },
    { label: "Open reports", value: String(openReports), trend: "Support review required" },
    { label: "Reward balance", value: formatEuro(payoutCents), trend: "Net immutable ledger" },
  ];
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className="metric-card">
      <p>{metric.label}</p>
      <strong>{metric.value}</strong>
      <span>{metric.trend}</span>
    </article>
  );
}

function DataWarning({ states }: { states: Array<{ loading: boolean; error: string | null }> }) {
  const loading = states.some((state) => state.loading);
  const errors = states.map((state) => state.error).filter(Boolean);
  if (loading) return <p className="notice">Chargement des collections Firebase...</p>;
  if (errors.length > 0) return <p className="error-text">{errors.join(" | ")}</p>;
  return null;
}

function UsersTable({ users }: { users: FirestoreRecord[] }) {
  return (
    <TableSection id="users" title="Users">
      <thead><tr><th>User</th><th>Roles</th><th>Verification</th><th>Actions</th></tr></thead>
      <tbody>{users.map((user) => <UserRow key={user.id} user={user} />)}</tbody>
    </TableSection>
  );
}

function UserRow({ user }: { user: FirestoreRecord }) {
  const [roles, setRoles] = useState<RoleMap>(() => ({ ...emptyRoles, ...(user.roles as Partial<RoleMap> | undefined) }));
  const [status, setStatus] = useState("");
  async function save() {
    setStatus("Enregistrement...");
    try {
      await setUserRoles(user.id, roles);
      setStatus("Roles mis à jour");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur roles");
    }
  }
  return (
    <tr>
      <td><strong>{textValue(user.displayName ?? user.name, user.id)}</strong><span>{textValue(user.email, user.id)}</span></td>
      <td className="role-grid">{Object.keys(emptyRoles).map((role) => (
        <label key={role}><input type="checkbox" checked={roles[role as keyof RoleMap]} onChange={(event) => setRoles({ ...roles, [role]: event.target.checked })} />{role}</label>
      ))}</td>
      <td><Badge tone={user.driverVerified ? "ok" : "warning"}>{user.driverVerified ? "driver verified" : "review"}</Badge></td>
      <td><button className="small-button" onClick={save}>Sauver</button><span>{status}</span></td>
    </tr>
  );
}

function TripsTable({ trips, bookings }: { trips: FirestoreRecord[]; bookings: FirestoreRecord[] }) {
  return (
    <TableSection id="trips" title="Trips">
      <thead><tr><th>Trip</th><th>Driver</th><th>Seats</th><th>Bookings</th><th>Status</th></tr></thead>
      <tbody>{trips.map((trip) => (
        <tr key={trip.id}>
          <td>{textValue(trip.title, trip.id)}<span>{formatDate(trip.departureAt)}</span></td>
          <td>{textValue(trip.driverUserId)}</td>
          <td>{numberValue(trip.seatsAvailable)} / {numberValue(trip.seatsTotal)}</td>
          <td>{bookings.filter((booking) => booking.tripId === trip.id).length}</td>
          <td><Badge tone={statusTone(trip.status)}>{textValue(trip.status)}</Badge></td>
        </tr>
      ))}</tbody>
    </TableSection>
  );
}

function RideSessionsTable({ rideSessions }: { rideSessions: FirestoreRecord[] }) {
  return (
    <TableSection id="ride-sessions" title="Ride sessions">
      <thead><tr><th>Ride</th><th>Driver</th><th>Radar</th><th>Updated</th><th>Status</th></tr></thead>
      <tbody>{rideSessions.map((ride) => (
        <tr key={ride.id}><td>{ride.id}<span>{textValue(ride.tripId)}</span></td><td>{textValue(ride.driverUserId)}</td><td>{textValue(ride.lastRadarAction ?? ride.radarStatus)}</td><td>{formatDate(ride.updatedAt ?? ride.lastRadarEventAt)}</td><td><Badge tone={statusTone(ride.status)}>{textValue(ride.status)}</Badge></td></tr>
      ))}</tbody>
    </TableSection>
  );
}

function PayoutsTable({ payouts }: { payouts: PayoutCandidate[] }) {
  return (
    <TableSection id="payouts" title="Payouts">
      <thead><tr><th>User</th><th>Balance</th><th>Stripe</th><th>Action</th></tr></thead>
      <tbody>{payouts.map((candidate) => <PayoutRow key={candidate.userId} candidate={candidate} />)}</tbody>
    </TableSection>
  );
}

function PayoutRow({ candidate }: { candidate: PayoutCandidate }) {
  const [status, setStatus] = useState("");
  async function pay() {
    setStatus("Envoi...");
    try {
      await issueRewardPayout(candidate.userId, candidate.balanceCents);
      setStatus("Payout demandé");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur payout");
    }
  }
  return <tr><td>{candidate.userId}</td><td>{formatEuro(candidate.balanceCents)}</td><td><Badge tone={candidate.stripeReady ? "ok" : "warning"}>{candidate.stripeReady ? "ready" : "blocked"}</Badge></td><td><button className="small-button" disabled={!candidate.stripeReady || candidate.balanceCents <= 0} onClick={pay}>Payout</button><span>{status}</span></td></tr>;
}
