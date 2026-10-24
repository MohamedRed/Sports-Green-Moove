import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

const processors = [
  {
    name: "Firebase",
    purpose: "authentification, base de donnees, fonctions cloud et notifications",
    url: "https://firebase.google.com/support/privacy",
  },
  {
    name: "Meta",
    purpose: "connexion Facebook lorsque l'utilisateur choisit ce fournisseur",
    url: "https://www.facebook.com/privacy/policy/",
  },
  {
    name: "Radar",
    purpose: "suivi de trajet actif, geofences et arrivees",
    url: "https://radar.com/privacy",
  },
  {
    name: "Google Maps Platform",
    purpose: "recherche d'adresses, calculs d'itineraire, distance et ETA",
    url: "https://policies.google.com/privacy",
  },
  {
    name: "Stripe Connect",
    purpose: "paiements, comptes connectes, transferts et rapprochement",
    url: "https://stripe.com/privacy",
  },
];

const dataCategories = [
  ["Identite du compte", "nom, email, Firebase UID et fournisseurs de connexion", "authentification, roles et support"],
  ["Enfants et responsables", "profils enfant, tuteurs, clubs et equipes", "consentement, participation aux trajets et securite"],
  ["Localisation precise", "positions conducteur et enfant pendant une course active", "securite du trajet, ETA et alertes de position perimee"],
  ["Paiements", "identifiants Stripe, intentions de paiement et grands livres", "paiement des trajets, recompenses et rapprochement"],
  ["Messages et signalements", "chat, demandes support et evenements d'audit", "coordination de trajet, support et revue securite"],
  ["Impact environnemental", "distance, CO2 et recompenses", "rapport d'impact et avantages Green-mOOVe"],
];

export function PrivacyPolicyPage() {
  return (
    <main className="privacy-page">
      <section className="privacy-hero" aria-labelledby="privacy-title">
        <Wordmark />
        <p className="eyebrow">Politique publique</p>
        <h1 id="privacy-title">Politique de confidentialite</h1>
        <p>
          SPORTS GREEN-mOOVe utilise les donnees uniquement pour le covoiturage sportif
          et culturel, la securite des trajets actifs, les paiements, le support et les
          rapports d'impact environnemental.
        </p>
        <p className="privacy-updated">Derniere mise a jour: 17 juin 2026</p>
      </section>

      <section className="privacy-section" aria-labelledby="privacy-summary">
        <h2 id="privacy-summary">Resume</h2>
        <div className="privacy-grid">
          <PolicyCard title="Pas de vente de donnees">
            Nous ne vendons pas de donnees personnelles et nous n'utilisons pas la
            localisation ou les donnees enfant pour la publicite ou le tracking tiers.
          </PolicyCard>
          <PolicyCard title="Suivi limite aux trajets actifs">
            La localisation precise commence seulement pendant une course active et
            s'arrete lorsque le trajet est termine.
          </PolicyCard>
          <PolicyCard title="Consentement responsable legal">
            Les profils enfant et le suivi enfant exigent le consentement explicite du
            responsable legal et restent limites aux besoins de securite.
          </PolicyCard>
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="privacy-data">
        <h2 id="privacy-data">Donnees traitees</h2>
        <div className="privacy-table-wrap">
          <table className="privacy-table">
            <thead>
              <tr>
                <th>Categorie</th>
                <th>Exemples</th>
                <th>Finalite</th>
              </tr>
            </thead>
            <tbody>
              {dataCategories.map(([category, examples, purpose]) => (
                <tr key={category}>
                  <td data-label="Categorie">{category}</td>
                  <td data-label="Exemples">{examples}</td>
                  <td data-label="Finalite">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="privacy-location">
        <h2 id="privacy-location">Localisation et securite enfant</h2>
        <ul className="privacy-list">
          <li>La localisation en arriere-plan sert uniquement a maintenir le suivi fiable pendant une course active.</li>
          <li>Les parents peuvent utiliser le suivi du vehicule si le suivi enfant n'est pas disponible.</li>
          <li>Les lectures de trajet sont limitees au conducteur, aux parents participants, aux enfants autorises et aux admins.</li>
          <li>Les evenements de prise en charge, depot, Radar et localisation native sont conserves pour l'audit securite.</li>
        </ul>
      </section>

      <section className="privacy-section" aria-labelledby="privacy-processors">
        <h2 id="privacy-processors">Partenaires et processeurs</h2>
        <div className="processor-list">
          {processors.map((processor) => (
            <article className="processor-card" key={processor.name}>
              <h3>{processor.name}</h3>
              <p>{processor.purpose}</p>
              <a href={processor.url} rel="noreferrer" target="_blank">{processor.url}</a>
            </article>
          ))}
        </div>
      </section>

      <section className="privacy-section" aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">Suppression et droits</h2>
        <p>
          Vous pouvez demander la suppression de votre compte, des profils enfant et des
          donnees modifiables associees. Les donnees devant rester disponibles pour les
          obligations legales, les paiements ou les audits de securite peuvent etre
          conservees selon les exigences applicables.
        </p>
        <p>
          Pour toute demande de confidentialite, contactez l'equipe SPORTS GREEN-mOOVe
          via le support de l'application ou l'adresse administrative publiee par l'ASBL.
        </p>
      </section>
    </main>
  );
}

function PolicyCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="policy-card">
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}
