export function takeChildInvitationToken(location: Pick<Location, "hash" | "pathname" | "search">, history: Pick<History, "replaceState">) {
  const token = location.hash.slice(1);
  history.replaceState(null, "", location.pathname);
  return !location.search && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function invitationSignupError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  if (code === "functions/already-exists") return "Cet e-mail est déjà utilisé. Aucun compte existant n’a été modifié.";
  if (code === "functions/resource-exhausted") return "Veuillez patienter une minute avant de réessayer.";
  if (code === "functions/failed-precondition" || code === "functions/permission-denied")
    return "Ce lien est indisponible. Si l’inscription a déjà commencé, conservez les mêmes identifiants.";
  return "L’inscription n’a pas pu être confirmée. Réessayez avec les mêmes identifiants.";
}
