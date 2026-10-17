import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const node = process.execPath;
const script = "scripts/check-provider-readiness.mjs";

const validEnv = {
  FIREBASE_ANDROID_CONFIG_BASE64: base64(JSON.stringify({
    project_info: { project_id: "sports-green-moove-prod" },
    client: [{ client_info: { mobilesdk_app_id: "1:1234567890:android:abcdef" } }],
  })),
  FIREBASE_IOS_CONFIG_BASE64: base64(`
    <plist><dict>
      <key>GOOGLE_APP_ID</key><string>1:1234567890:ios:abcdef</string>
      <key>PROJECT_ID</key><string>sports-green-moove-prod</string>
      <key>BUNDLE_ID</key><string>be.sportgreenmoove.app</string>
      <key>CLIENT_ID</key><string>1234567890.apps.googleusercontent.com</string>
    </dict></plist>
  `),
  VITE_FIREBASE_API_KEY: "AIza" + "a".repeat(35),
  VITE_FIREBASE_AUTH_DOMAIN: "sports-green-moove.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "sports-green-moove-prod",
  VITE_FIREBASE_DATABASE_URL: "https://sports-green-moove-default-rtdb.europe-west1.firebasedatabase.app",
  VITE_FIREBASE_STORAGE_BUCKET: "sports-green-moove.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  VITE_FIREBASE_APP_ID: "1:1234567890:web:abcdef123456",
  GOOGLE_MAPS_API_KEY: "AIza" + "b".repeat(35),
  SGM_GOOGLE_MAPS_ANDROID_API_KEY: "AIza" + "c".repeat(35),
  SGM_GOOGLE_MAPS_IOS_API_KEY: "AIza" + "d".repeat(35),
  SGM_GOOGLE_REVERSED_CLIENT_ID: "com.googleusercontent.apps.1234567890-abcdef",
  RADAR_WEBHOOK_SECRET: "radar_webhook_secret_123",
  SGM_RADAR_PUBLISHABLE_KEY: "radar_publishable_key_123",
  STRIPE_SECRET_KEY: "sk_live_" + "e".repeat(24),
  STRIPE_PUBLISHABLE_KEY: "pk_live_" + "f".repeat(24),
  STRIPE_WEBHOOK_SECRET: "whsec_" + "g".repeat(24),
  SGM_STRIPE_CONNECT_RETURN_URL: "https://app.sportgreenmoove.be/payments/return",
  SGM_STRIPE_CONNECT_REFRESH_URL: "https://app.sportgreenmoove.be/payments/refresh",
  SGM_FACEBOOK_APP_ID: "123456789012345",
  SGM_FACEBOOK_CLIENT_TOKEN: "facebookclienttoken123",
};

const validOutput = execFileSync(node, [script], { env: testEnv(validEnv), encoding: "utf8" });
assert.match(validOutput, /Provider readiness validated for production/);
assert.match(validOutput, /production launch provider variables/);

const socialAuthOutput = execFileSync(node, [script, "--include-postponed-social-auth"], { env: testEnv(validEnv), encoding: "utf8" });
assert.match(socialAuthOutput, /provider and postponed social-auth variables/);

assertFailure(
  { ...validEnv, STRIPE_SECRET_KEY: "" },
  /STRIPE_SECRET_KEY is required/,
  "Missing production secrets must fail.",
);

assertFailure(
  { ...validEnv, GOOGLE_MAPS_API_KEY: "TODO" },
  /GOOGLE_MAPS_API_KEY contains placeholder text/,
  "Placeholder values must fail.",
);

assertFailure(
  { ...validEnv, STRIPE_SECRET_KEY: "sk_test_" + "e".repeat(24) },
  /STRIPE_SECRET_KEY must start with sk_live_/,
  "Stripe test keys must not pass production readiness.",
);

const postponedSocialAuthEnv = {
  ...validEnv,
  SGM_GOOGLE_REVERSED_CLIENT_ID: "",
  SGM_FACEBOOK_APP_ID: "",
  SGM_FACEBOOK_CLIENT_TOKEN: "",
};
const productionOnlyOutput = execFileSync(node, [script], {
  env: testEnv(postponedSocialAuthEnv),
  encoding: "utf8",
});
assert.match(productionOnlyOutput, /production launch provider variables/);

const firebaseWithoutOauthClient = {
  ...validEnv,
  FIREBASE_IOS_CONFIG_BASE64: base64(`
    <plist><dict>
      <key>GOOGLE_APP_ID</key><string>1:1234567890:ios:abcdef</string>
      <key>PROJECT_ID</key><string>sports-green-moove-prod</string>
      <key>BUNDLE_ID</key><string>be.sportgreenmoove.app</string>
    </dict></plist>
  `),
};
const firebaseOnlyOutput = execFileSync(node, [script], {
  env: testEnv(firebaseWithoutOauthClient),
  encoding: "utf8",
});
assert.match(firebaseOnlyOutput, /production launch provider variables/);
assertFailure(
  firebaseWithoutOauthClient,
  /FIREBASE_IOS_CONFIG_BASE64 must decode to a GoogleService-Info\.plist containing CLIENT_ID/,
  "Postponed social-auth validation must require the iOS OAuth client id.",
  ["--include-postponed-social-auth"],
);
assertFailure(
  postponedSocialAuthEnv,
  /SGM_GOOGLE_REVERSED_CLIENT_ID is required/,
  "Postponed social-auth secrets must fail when explicitly included.",
  ["--include-postponed-social-auth"],
);

console.log("Provider readiness checks passed.");

function assertFailure(env, pattern, message, args = []) {
  let failed = false;
  try {
    execFileSync(node, [script, ...args], { env: testEnv(env), encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    failed = true;
    assert.match(String(error.stderr), pattern);
  }
  assert.equal(failed, true, message);
}

function testEnv(values) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    ...values,
  };
}

function base64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}
