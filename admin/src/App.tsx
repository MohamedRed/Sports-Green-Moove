import { useState } from "react";
import { firebaseProjectLabel, hasFirebaseConfig } from "./firebase";
import { signInAdmin, signOutAdmin, useAdminAuth } from "./useAdminAuth";
import { AdminDashboard } from "./AdminDashboard";
import { Wordmark } from "./Wordmark";
import { ClubDashboard } from "./ClubDashboard";

export function App() {
  const auth = useAdminAuth();

  if (!hasFirebaseConfig) {
    return <Gate title="Configuration requise" detail="L'espace de gestion n'est pas encore configuré." />;
  }

  if (auth.loading) return <Gate title="Connexion" detail="Vérification de votre session..." />;
  if (auth.error) return <Gate title="Connexion impossible" detail="Reconnectez-vous pour accéder à la gestion." onSignOut={signOutAdmin} />;
  if (!auth.user) return <LoginPanel />;
  if (!auth.roleKeys.includes("admin") && auth.roleKeys.includes("clubManager")) {
    return <ClubDashboard key={auth.user.uid} uid={auth.user.uid} onSignOut={signOutAdmin} />;
  }
  if (!auth.roleKeys.includes("admin")) {
    return <Gate title="Accès réservé" detail="Ce compte n'a pas accès à la gestion." onSignOut={signOutAdmin} />;
  }

  return <AdminDashboard key={auth.user.uid} uid={auth.user.uid} userEmail={auth.user.email ?? auth.user.uid} projectLabel={firebaseProjectLabel}
    canReviewGuardians={auth.roleKeys.includes("clubManager")} onSignOut={signOutAdmin} />;
}

function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInAdmin(email, password);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="center-screen">
      <form className="auth-panel" onSubmit={submit}>
        <Wordmark />
        <h1>Espace de gestion</h1>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label>
          Mot de passe
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button" disabled={submitting}>{submitting ? "Connexion..." : "Se connecter"}</button>
      </form>
    </main>
  );
}

function Gate({ title, detail, onSignOut }: { title: string; detail: string; onSignOut?: () => void }) {
  return (
    <main className="center-screen">
      <section className="auth-panel">
        <Wordmark />
        <h1>{title}</h1>
        <p>{detail}</p>
        {onSignOut ? <button className="secondary-button" onClick={onSignOut}>Se déconnecter</button> : null}
      </section>
    </main>
  );
}
