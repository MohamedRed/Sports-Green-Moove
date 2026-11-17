import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Wordmark";
import { invitationSignupError } from "./childInvitationLink";
import { redeemInvitation } from "./childInvitationGateway";
import "./invitationTokens.css";
import "./childInvitation.css";

export function ChildInvitationPage({ token, submit = redeemInvitation }: {
  token: string | null; submit?: (token: string, email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true), submitting = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!token || submitting.current || created) return;
    if (password !== confirmation) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 12 || password.length > 128) { setError("Choisissez un mot de passe de 12 à 128 caractères."); return; }
    submitting.current = true; setBusy(true); setError(null);
    try {
      await submit(token, email, password);
      if (active.current) { setCreated(true); setPassword(""); setConfirmation(""); setEmail(""); }
    } catch (failure) { if (active.current) setError(invitationSignupError(failure)); }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  }

  return <main className="child-invitation-page">
    <div className="child-invitation-brand"><Wordmark /></div>
    <section className="child-invitation-content">
      <h1>{!token ? "Invitation indisponible" : created ? "Compte créé" : "Créer mon compte enfant"}</h1>
      {!token ? <p>Demandez un nouveau lien à votre parent.</p> : created ? <>
        <p>L’accord du parent reste nécessaire pour relier votre compte à votre profil.</p>
        <a className="child-invitation-primary" href="sports-green-moove://account">Ouvrir l’application</a>
      </> : <form onSubmit={create}>
        <label>E-mail<input name="email" type="email" autoComplete="username" required maxLength={254}
          value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
        <label>Mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
        <label>Confirmer le mot de passe<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></label>
        {error ? <p role="alert">{error}</p> : null}
        <button className="child-invitation-primary" disabled={busy}>{busy ? "Création…" : "Créer mon compte"}</button>
        <a className="child-invitation-privacy" href="/privacy">Confidentialité</a>
      </form>}
    </section>
  </main>;
}
