import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./controls.css";
import "./memberships.css";
import "./privacy.css";

const root = createRoot(document.getElementById("root") as HTMLElement);

renderRoute(window.location.pathname);

async function renderRoute(pathname: string) {
  if (pathname === "/child-invitation" || pathname === "/child-invitation/") {
    document.documentElement.lang = "fr";
    document.title = "Compte enfant | Sports Green-Moove";
    const { takeChildInvitationToken } = await import("./childInvitationLink");
    const token = takeChildInvitationToken(window.location, window.history);
    const { ChildInvitationPage } = await import("./ChildInvitationPage");
    root.render(<StrictMode><ChildInvitationPage token={token} /></StrictMode>);
    return;
  }
  if (isPublicPrivacyRoute(pathname)) {
    const { PrivacyPolicyPage } = await import("./PrivacyPolicyPage");
    root.render(
      <StrictMode>
        <PrivacyPolicyPage />
      </StrictMode>,
    );
    return;
  }

  const { App } = await import("./App");
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

function isPublicPrivacyRoute(pathname: string) {
  return pathname === "/privacy" || pathname === "/privacy/";
}
