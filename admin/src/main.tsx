import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { firebaseApp } from "./firebase";

type Metric = {
  label: string;
  value: string;
  trend: string;
};

type QueueItem = {
  title: string;
  detail: string;
  status: "ok" | "warning" | "review";
};

const metrics: Metric[] = [
  { label: "Active ride sessions", value: "18", trend: "4 with child-device tracking" },
  { label: "Bookings pending", value: "42", trend: "Driver approval required" },
  { label: "CO2 saved", value: "128 kg", trend: "This month" },
  { label: "Payouts queued", value: "EUR 840", trend: "Stripe reconciliation" },
];

const reviewQueue: QueueItem[] = [
  {
    title: "Guardian consent check",
    detail: "3 children need renewed background-location consent.",
    status: "warning",
  },
  {
    title: "Driver verification",
    detail: "7 new drivers waiting for profile and vehicle review.",
    status: "review",
  },
  {
    title: "Radar webhook health",
    detail: "All active ride sessions updated in the last 60 seconds.",
    status: "ok",
  },
];

const rideSessions: QueueItem[] = [
  {
    title: "U8 Nationaux - Royal Ottignies",
    detail: "Vehicle live, 2 children picked up, ETA 16:38.",
    status: "ok",
  },
  {
    title: "College du Biereau training",
    detail: "Native fallback wrote latest driver location 2 minutes ago.",
    status: "warning",
  },
  {
    title: "Support report #1842",
    detail: "Parent requested review of delayed dropoff confirmation.",
    status: "review",
  },
];

function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Admin navigation">
        <div className="wordmark" aria-label="Sports Green Moove">
          <span>SPORTS </span>
          <strong>GREEN-</strong>
          <b>m</b>
          <em>OO</em>
          <b>Ve</b>
        </div>
        <nav>
          {["Overview", "Clubs", "Users", "Trips", "Ride sessions", "Payouts", "Reports", "Support"].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`}>
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Firebase project</p>
            <h1>Public launch operations</h1>
          </div>
          <span className="project-pill">{firebaseApp.options.projectId || "dev project"}</span>
        </header>

        <section className="metric-grid" aria-label="Launch metrics">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.trend}</span>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          <Panel title="Safety review queue" items={reviewQueue} />
          <Panel title="Active ride sessions" items={rideSessions} />
        </section>

        <section className="table-panel" id="trips">
          <div>
            <p className="eyebrow">Trip moderation</p>
            <h2>Published trips</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Trip</th>
                <th>Driver</th>
                <th>Seats</th>
                <th>Tracking</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>U8 Nationaux vs Royal Ottignies SC</td>
                <td>Nadege Toussaint</td>
                <td>2 / 4</td>
                <td>Radar + native fallback</td>
                <td><Badge status="ok" label="Ready" /></td>
              </tr>
              <tr>
                <td>Entrainement U8 Groupe B</td>
                <td>Kevin Martin</td>
                <td>1 / 3</td>
                <td>Vehicle only</td>
                <td><Badge status="warning" label="Consent review" /></td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}

function Panel({ title, items }: { title: string; items: QueueItem[] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="queue">
        {items.map((item) => (
          <article className="queue-item" key={item.title}>
            <Badge status={item.status} label={item.status} />
            <div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Badge({ status, label }: { status: QueueItem["status"]; label: string }) {
  return <span className={`badge ${status}`}>{label}</span>;
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
