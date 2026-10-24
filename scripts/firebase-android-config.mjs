import { execFileSync } from "node:child_process";

export async function androidApiKey(projectId) {
  const configuredKey = process.env.SGM_FIREBASE_WEB_API_KEY ?? process.env.VITE_FIREBASE_API_KEY;
  if (configuredKey?.trim()) return configuredKey.trim();

  const cliKey = androidApiKeyFromFirebaseCli(projectId);
  if (cliKey) return cliKey;

  const restKey = await androidApiKeyFromGoogleCredentials(projectId);
  if (restKey) return restKey;

  throw new Error(
    "Could not resolve an Android Firebase API key. Set SGM_FIREBASE_WEB_API_KEY, reauth Firebase CLI, or configure Google application-default credentials.",
  );
}

function androidApiKeyFromFirebaseCli(projectId) {
  try {
    const apps = parseFirebaseJson(firebaseCli(["apps:list", "--project", projectId, "--json"])).result ?? [];
    const androidApp = apps.find((app) => app.platform === "ANDROID" && app.state === "ACTIVE");
    if (!androidApp?.appId) return undefined;

    const config = parseFirebaseJson(firebaseCli([
      "apps:sdkconfig",
      "ANDROID",
      androidApp.appId,
      "--project",
      projectId,
      "--json",
    ])).result;
    return keyFromGoogleServicesJson(config.fileContents);
  } catch {
    return undefined;
  }
}

async function androidApiKeyFromGoogleCredentials(projectId) {
  const accessToken = googleApplicationDefaultAccessToken();
  if (!accessToken) return undefined;

  const appsResponse = await firebaseRest(projectId, "androidApps", accessToken);
  const androidApp = appsResponse.apps?.find((app) => app.state === "ACTIVE");
  if (!androidApp?.appId) return undefined;

  const config = await firebaseRest(projectId, `androidApps/${androidApp.appId}/config`, accessToken);
  const decoded = Buffer.from(config.configFileContents, "base64").toString("utf8");
  return keyFromGoogleServicesJson(decoded);
}

async function firebaseRest(projectId, path, accessToken) {
  const response = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Firebase REST ${path} failed: ${JSON.stringify(body)}`);
  return body;
}

function googleApplicationDefaultAccessToken() {
  for (const command of googleTokenCommands()) {
    try {
      return execFileSync(command.bin, command.args, {
        encoding: "utf8",
        env: { ...process.env, ...command.env },
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      // Keep CLI-specific failures from blocking other configured sources.
    }
  }
  return undefined;
}

function googleTokenCommands() {
  return [
    { bin: "gcloud", args: ["auth", "application-default", "print-access-token", "--quiet"], env: {} },
  ];
}

function parseFirebaseJson(output) {
  const start = output.indexOf("{");
  if (start < 0) throw new Error("Firebase CLI did not return JSON.");
  return JSON.parse(output.slice(start));
}

function firebaseCli(args) {
  return execFileSync("firebase", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function keyFromGoogleServicesJson(fileContents) {
  const contents = JSON.parse(fileContents);
  return contents.client?.[0]?.api_key?.[0]?.current_key;
}
