import { useEffect, useRef } from "react";
import type { MembershipDecision, ReviewMembership } from "./membershipReviewTypes";

export function MembershipConfirmation({ item, decision, clubName, onClose, onConfirm }: {
  item: ReviewMembership; decision: MembershipDecision; clubName: string; onClose: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); return () => { dialog.current?.close(); }; }, []);
  return <dialog className="membership-confirmation" ref={dialog} aria-labelledby="membership-confirm-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id="membership-confirm-title">{decision === "approve" ? "Accepter l'adhésion ?" : "Refuser l'adhésion ?"}</h2>
    <p>{item.name ?? "Nom indisponible"}</p><p>{clubName}</p>
    <div className="membership-actions">
      <button className="secondary-button" onClick={onClose}>Revenir</button>
      <button className="primary-button" onClick={onConfirm}>Confirmer</button>
    </div>
  </dialog>;
}
