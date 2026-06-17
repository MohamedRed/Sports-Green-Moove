import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./controls.css";
import "./privacy.css";

const root = createRoot(document.getElementById("root") as HTMLElement);

renderRoute(window.location.pathname);

async function renderRoute(pathname: string) {
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
