import { useEffect, useRef } from "react";
import type { TeamDecision, TeamReview } from "./teamReviewTypes";

export function TeamReviewConfirmation({ item, action, clubName, teamName, onClose, onConfirm }: {
  item: TeamReview; action: TeamDecision; clubName: string; teamName: string | null; onClose: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { element?.close(); }; }, []);
  const title = action === "approve" ? "Approuver cette inscription ?" : action === "refuse" ? "Refuser cette demande ?" : "Retirer cette inscription ?";
  return <dialog ref={dialog} className="membership-confirmation team-confirmation" aria-labelledby="team-confirm-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id="team-confirm-title">{title}</h2>
    <p>{item.subjectName ?? "Nom indisponible"}</p>
    <p>{item.subjectKind === "child" ? "Enfant" : "Membre"}</p><p>{teamName ?? "Nom d'équipe indisponible"}</p><p>{clubName}</p>
    <div className="membership-actions">
      <button className="secondary-button" autoFocus onClick={onClose}>Revenir</button>
      <button className="primary-button" onClick={onConfirm}>Confirmer</button>
    </div>
  </dialog>;
}
