import { applicationDefault, deleteApp, initializeApp } from "firebase-admin/app";
import { expect, it, vi } from "vitest";

it("loads Firestore-only history preparation without a Realtime Database URL or credential request", async () => {
  const credential = applicationDefault();
  const getAccessToken = vi.spyOn(credential, "getAccessToken").mockRejectedValue(new Error("Import must not request a token"));
  const app = initializeApp({ projectId: "demo-chat-index-bootstrap", credential });
  try {
    const { prepareChatInbox } = await import("../lib/prepareChatInbox.js");
    expect(typeof prepareChatInbox).toBe("function");
    expect(app.options.databaseURL).toBeUndefined();
    expect(getAccessToken).not.toHaveBeenCalled();
  } finally { getAccessToken.mockRestore(); await deleteApp(app); }
});
