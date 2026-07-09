import { useState } from "react";
import { firebaseProjectLabel, hasFirebaseConfig } from "./firebase";
import { signInAdmin, signOutAdmin, useAdminAuth } from "./useAdminAuth";
import { AdminDashboard } from "./AdminDashboard";
import { Wordmark } from "./Wordmark";

export function App() {
  const auth = useAdminAuth();

  if (!hasFirebaseConfig) {
    return <Gate title="Configuration requise" detail="Renseignez les variables VITE_FIREBASE_* de l'admin console." />;
  }

  if (auth.loading) return <Gate title="Connexion Firebase" detail="Lecture de la session administrateur..." />;
  if (auth.error) return <Gate title="Erreur Firebase Auth" detail={auth.error} onSignOut={signOutAdmin} />;
  if (!auth.user) return <LoginPanel />;
  if (!auth.roleKeys.includes("admin")) {
    return <Gate title="Accès admin requis" detail="Le compte connecté n'a pas le claim roleKeys: admin." onSignOut={signOutAdmin} />;
  }

  return <AdminDashboard userEmail={auth.user.email ?? auth.user.uid} projectLabel={firebaseProjectLabel} onSignOut={signOutAdmin} />;
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
        <h1>Admin console</h1>
        <p>Connectez-vous avec un compte Firebase ayant le role admin.</p>
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
