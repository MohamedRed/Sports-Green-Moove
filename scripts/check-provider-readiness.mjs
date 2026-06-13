#!/usr/bin/env node

const environment = parseEnvironment(process.argv.slice(2));
const errors = [];

const checks = [
  group("firebase", [
    required("FIREBASE_ANDROID_CONFIG_BASE64", "Android Firebase app config", validateAndroidFirebaseConfig),
    required("FIREBASE_IOS_CONFIG_BASE64", "iOS Firebase app config", validateIosFirebaseConfig),
    required("VITE_FIREBASE_API_KEY", "Admin Firebase web API key", minLength(20)),
    required("VITE_FIREBASE_AUTH_DOMAIN", "Admin Firebase auth domain", minLength(6)),
    required("VITE_FIREBASE_PROJECT_ID", "Admin Firebase project id", minLength(3)),
    required("VITE_FIREBASE_DATABASE_URL", "Admin Firebase Realtime Database URL", httpsUrl),
    required("VITE_FIREBASE_STORAGE_BUCKET", "Admin Firebase Storage bucket", minLength(6)),
    required("VITE_FIREBASE_MESSAGING_SENDER_ID", "Admin Firebase sender id", numeric),
    required("VITE_FIREBASE_APP_ID", "Admin Firebase app id", minLength(12)),
  ]),
  group("googleMaps", [
    required("GOOGLE_MAPS_API_KEY", "Cloud Functions Google Routes and Places key", googleApiKey),
    required("SGM_GOOGLE_MAPS_ANDROID_API_KEY", "Android Google Maps SDK key", googleApiKey),
    required("SGM_GOOGLE_MAPS_IOS_API_KEY", "iOS Google Maps SDK key", googleApiKey),
    required("SGM_GOOGLE_REVERSED_CLIENT_ID", "iOS Google sign-in reversed client id", reversedGoogleClientId),
  ]),
  group("radar", [
    required("RADAR_WEBHOOK_SECRET", "Radar webhook signing secret", minLength(16)),
    required("SGM_RADAR_PUBLISHABLE_KEY", "Native Radar publishable key", minLength(16)),
  ]),
  group("stripeConnect", [
    required("STRIPE_SECRET_KEY", "Stripe live secret key", startsWith("sk_live_")),
    required("STRIPE_PUBLISHABLE_KEY", "Stripe live publishable key", startsWith("pk_live_")),
    required("STRIPE_WEBHOOK_SECRET", "Stripe webhook signing secret", startsWith("whsec_")),
    required("SGM_STRIPE_CONNECT_RETURN_URL", "Stripe Connect return URL", httpsUrl),
    required("SGM_STRIPE_CONNECT_REFRESH_URL", "Stripe Connect refresh URL", httpsUrl),
  ]),
  group("metaFacebook", [
    required("SGM_FACEBOOK_APP_ID", "Meta Facebook app id", numeric),
    required("SGM_FACEBOOK_CLIENT_TOKEN", "Meta Facebook client token", minLength(12)),
  ]),
];

for (const providerGroup of checks) {
  validateGroup(providerGroup);
}

if (errors.length > 0) {
  console.error(`Provider readiness check failed for ${environment}:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

const variableCount = checks.reduce((total, providerGroup) => total + providerGroup.items.length, 0);
console.log(`Provider readiness validated for ${environment}: ${variableCount} variables present and structurally valid.`);

function validateGroup(providerGroup) {
  for (const item of providerGroup.items) {
    const value = process.env[item.name];
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`${item.name} is required for ${providerGroup.id}: ${item.description}`);
      continue;
    }
    if (isPlaceholder(value)) {
      errors.push(`${item.name} contains placeholder text`);
      continue;
    }
    const validationError = item.validate(value);
    if (validationError) {
      errors.push(`${item.name} ${validationError}`);
    }
  }
}

function group(id, items) {
  return { id, items };
}

function required(name, description, validate) {
  return { name, description, validate };
}

function minLength(length) {
  return (value) => value.trim().length >= length ? undefined : `must be at least ${length} characters`;
}

function startsWith(prefix) {
  return (value) => value.startsWith(prefix) ? undefined : `must start with ${prefix}`;
}

function numeric(value) {
  return /^[0-9]+$/.test(value) ? undefined : "must contain only digits";
}

function googleApiKey(value) {
  if (value.length < 20) return "must be at least 20 characters";
  return /^AIza[0-9A-Za-z_-]+$/.test(value) ? undefined : "must look like a Google API key";
}

function reversedGoogleClientId(value) {
  return /^com\.googleusercontent\.apps\.[0-9A-Za-z_-]+$/.test(value)
    ? undefined
    : "must look like a reversed Google OAuth client id";
}

function httpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? undefined : "must use https";
  } catch {
    return "must be a valid URL";
  }
}

function validateAndroidFirebaseConfig(value) {
  const decoded = decodeBase64(value);
  if (!decoded.ok) return decoded.error;
  try {
    const parsed = JSON.parse(decoded.text);
    if (!parsed.project_info?.project_id) return "must contain project_info.project_id";
    if (!Array.isArray(parsed.client) || parsed.client.length === 0) return "must contain at least one Firebase client";
    return undefined;
  } catch {
    return "must decode to a valid google-services.json payload";
  }
}

function validateIosFirebaseConfig(value) {
  const decoded = decodeBase64(value);
  if (!decoded.ok) return decoded.error;
  for (const key of ["GOOGLE_APP_ID", "PROJECT_ID", "BUNDLE_ID", "CLIENT_ID"]) {
    if (!decoded.text.includes(`<key>${key}</key>`)) {
      return `must decode to a GoogleService-Info.plist containing ${key}`;
    }
  }
  return undefined;
}

function decodeBase64(value) {
  try {
    const buffer = Buffer.from(value, "base64");
    const text = buffer.toString("utf8");
    if (text.trim().length === 0) return { ok: false, error: "must decode to non-empty content" };
    return { ok: true, text };
  } catch {
    return { ok: false, error: "must be base64 encoded" };
  }
}

function isPlaceholder(value) {
  return /\b(TODO|TBD|PLACEHOLDER|PENDING|EXAMPLE|SAMPLE|REPLACE_ME)\b/i.test(value);
}

function parseEnvironment(args) {
  const index = args.indexOf("--environment");
  if (index === -1) return "production";
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error("--environment requires a value");
    process.exit(1);
  }
  return value;
}

