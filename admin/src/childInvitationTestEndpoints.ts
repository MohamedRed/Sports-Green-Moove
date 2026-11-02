export function childInvitationTestEndpoints(input: {
  approved?: string; development: boolean; emulators: boolean; projectId?: string; origin: string;
}) {
  if (input.approved !== undefined && input.approved !== "false" && input.approved !== "true") {
    throw new Error("Unexpected isolated invitation mode");
  }
  if (input.approved !== "true") return {
    authUrl: "http://127.0.0.1:9099", functionsHost: "127.0.0.1", functionsPort: 5001,
  };
  if (!input.development || !input.emulators || input.projectId !== "demo-sgm-local-qa") {
    throw new Error("Same-origin invitation testing requires isolated development");
  }
  const url = new URL(input.origin);
  if (url.protocol !== "http:" || url.port !== "4185" ||
    !["127.0.0.1", "bs-local.com"].includes(url.hostname) || url.origin !== input.origin) {
    throw new Error("Unapproved isolated invitation origin");
  }
  return {authUrl: url.origin, functionsHost: url.hostname, functionsPort: 4185};
}
