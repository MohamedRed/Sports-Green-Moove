import { MembershipReviewPanel } from "./MembershipReviewPanel";
import { Wordmark } from "./Wordmark";

export function ClubDashboard({ uid, onSignOut }: { uid: string; onSignOut: () => void }) {
  return <main className="club-workspace">
    <header className="topbar"><Wordmark /><button className="secondary-button" onClick={onSignOut}>Se déconnecter</button></header>
    <h1>Votre club</h1>
    <MembershipReviewPanel uid={uid} />
  </main>;
}
