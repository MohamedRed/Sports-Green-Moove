import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const files = {
  androidGradle: read("android/app/build.gradle.kts"),
  androidManifest: read("android/app/src/main/AndroidManifest.xml"),
  androidStrings: read("android/app/src/main/res/values/strings.xml"),
  iosProject: read("ios/project.yml"),
  iosAppState: read("ios/Sources/SportsGreenMooveApp/AppState.swift"),
  iosRidePermissionGate: read("ios/Sources/SportsGreenMooveApp/ActiveRidePermissionGate.swift"),
  iosRideLifecycle: read("ios/Sources/SportsGreenMooveApp/AppStateRideLifecycle.swift"),
  iosPrivacy: read("ios/Sources/SportsGreenMooveApp/Resources/PrivacyInfo.xcprivacy"),
  dataSafety: read("docs/release/privacy-data-safety.md"),
  storeReadiness: read("docs/release/store-readiness.md"),
  evidenceTemplate: read("docs/release/evidence-manifest.example.json"),
  evidenceSchema: read("docs/release/evidence-schema.json"),
  realDeviceProtocol: read("docs/release/real-device-test-protocol.md"),
  providerValidator: read("scripts/check-provider-readiness.mjs"),
  evidenceValidator: read("scripts/validate-release-evidence.mjs"),
  packageJson: read("package.json"),
  backendCiWorkflow: read(".github/workflows/backend-ci.yml"),
  nativeCiWorkflow: read(".github/workflows/native-ci.yml"),
  releaseEvidenceWorkflow: read(".github/workflows/release-evidence.yml"),
  releaseReadinessWorkflow: read(".github/workflows/release-readiness.yml"),
};

for (const permission of [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_LOCATION",
  "android.permission.POST_NOTIFICATIONS",
]) {
  includes(files.androidManifest, permission, `Android manifest declares ${permission}`);
}

includes(files.androidManifest, 'android:foregroundServiceType="location"', "Android ride service is location-typed");
includes(files.androidManifest, 'android:exported="false"', "Android ride service is not exported");
includes(files.androidManifest, "com.facebook.sdk.ApplicationId", "Android declares Facebook app id metadata");
includes(files.androidManifest, "com.facebook.sdk.ClientToken", "Android declares Facebook client token metadata");
includes(files.androidManifest, "com.facebook.FacebookActivity", "Android declares Facebook login activity");
includes(files.androidManifest, "com.facebook.CustomTabActivity", "Android declares Facebook custom tab callback activity");
includes(files.androidManifest, "com.google.android.geo.API_KEY", "Android declares Google Maps SDK key metadata");
includes(files.androidGradle, "SGM_GOOGLE_MAPS_ANDROID_API_KEY", "Android build reads Google Maps API key");
includes(files.androidGradle, "com.google.android.gms:play-services-maps:20.0.0", "Android links Maps SDK");
includes(files.androidGradle, "com.google.maps.android:maps-compose:8.3.0", "Android links Maps Compose");
includes(files.androidGradle, "testInstrumentationRunner = \"androidx.test.runner.AndroidJUnitRunner\"", "Android UI tests use the AndroidX JUnit runner");

for (const key of [
  "active_ride_permission_disclosure_title",
  "active_ride_permission_disclosure_body",
  "active_ride_permission_blocked",
  "child_tracking_guardian_consent",
  "privacy_policy_summary",
]) {
  includes(files.androidStrings, `name="${key}"`, `Android string ${key} exists`);
}
includes(files.androidStrings, "arrière-plan", "Android prominent disclosure mentions background location");
includes(files.androidStrings, "course active", "Android prominent disclosure limits tracking to active rides");
includes(files.androidStrings, "consentement", "Android child tracking copy mentions consent");

for (const key of [
  "NSLocationWhenInUseUsageDescription",
  "NSLocationAlwaysUsageDescription",
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "UIBackgroundModes:",
  "- location",
  "SGMRadarPublishableKey",
  "FacebookAppID",
  "FacebookClientToken",
  "SGMGoogleMapsIOSAPIKey",
  "fb$(SGM_FACEBOOK_APP_ID)",
]) {
  includes(files.iosProject, key, `iOS project declares ${key}`);
}
includes(files.iosProject, "course active", "iOS usage strings limit tracking to active rides");
includes(files.iosProject, "product: FacebookLogin", "iOS project links FacebookLogin");
includes(files.iosProject, "https://github.com/googlemaps/ios-maps-sdk.git", "iOS project declares Google Maps SDK package");
includes(files.iosProject, "product: GoogleMaps", "iOS project links GoogleMaps");
includes(files.iosAppState, "requestActiveRideStart(tripId: tripId)", "iOS driver ride start uses permission disclosure gate");
excludes(files.iosAppState, "await startRide(tripId:", "iOS AppState does not bypass the permission gate");
includes(files.iosRideLifecycle, "startRideAfterPermissionGate", "iOS ride lifecycle exposes only post-permission start");
excludes(files.iosRideLifecycle, "func startRide(tripId:", "iOS ride lifecycle removed the ungated start entry point");
includes(files.iosRidePermissionGate, "ActiveRidePermissionPolicy.canStartActiveRide", "iOS active ride gate reuses native permission policy");
includes(files.iosRidePermissionGate, "requestAlwaysAuthorization()", "iOS active ride gate requests Always location before start");
includes(files.iosRidePermissionGate, "UNUserNotificationCenter", "iOS active ride gate checks notification authorization before start");
includes(files.iosRidePermissionGate, "ensureReadyForActiveRide", "iOS active ride gate coordinates required permissions before start");
includes(files.iosRidePermissionGate, "Pendant une course active", "iOS active ride disclosure explains background location before permission prompts");

for (const privacyType of [
  "NSPrivacyCollectedDataTypeName",
  "NSPrivacyCollectedDataTypeEmailAddress",
  "NSPrivacyCollectedDataTypeUserID",
  "NSPrivacyCollectedDataTypePreciseLocation",
]) {
  includes(files.iosPrivacy, privacyType, `iOS privacy manifest declares ${privacyType}`);
}
includes(files.iosPrivacy, "<key>NSPrivacyTracking</key>\n    <false/>", "iOS privacy manifest disables tracking");

for (const processorUrl of [
  "https://firebase.google.com/support/privacy",
  "https://www.facebook.com/privacy/policy/",
  "https://radar.com/privacy",
  "https://policies.google.com/privacy",
  "https://stripe.com/privacy",
]) {
  includes(files.dataSafety, processorUrl, `Data-safety doc includes ${processorUrl}`);
}
includes(files.dataSafety, "does not sell personal data", "Data-safety doc states no sale of personal data");
includes(files.dataSafety, "guardian consent", "Data-safety doc covers guardian consent");
includes(files.storeReadiness, "privacy-data-safety.md", "Store checklist links data-safety source");
includes(files.storeReadiness, "evidence-manifest.example.json", "Store checklist links release evidence manifest template");
includes(files.storeReadiness, "real-device-test-protocol.md", "Store checklist links real-device protocol");
includes(files.storeReadiness, "android-verification-notes.md", "Store checklist links Android verification notes");
includes(files.storeReadiness, "validate:provider-readiness", "Store checklist documents provider validation command");
includes(files.storeReadiness, "validate:release-evidence", "Store checklist documents evidence validation command");
includes(files.storeReadiness, "test:stripe-webhook-flow", "Store checklist documents Stripe webhook flow validation command");
includes(files.storeReadiness, "smoke:live-backend-flow", "Store checklist documents live backend smoke validation command");
includes(files.storeReadiness, "smoke:live-operations-flow", "Store checklist documents live operations smoke validation command");

for (const requiredEvidence of [
  "foreground_tracking",
  "background_tracking",
  "locked_screen_tracking",
  "gps_loss",
  "network_loss",
  "app_restart",
  "battery_saver",
  "radar_webhook_delay",
  "firebase_native_fallback",
  "active_ride_tracking_screenshot",
  "google_maps_route_preview_screenshot",
  "stale_location_warning_screenshot",
  "emergency_contact_action_screenshot",
  "permission_education_screenshot",
]) {
  includes(files.evidenceTemplate, requiredEvidence, `Release evidence template includes ${requiredEvidence}`);
  includes(files.evidenceValidator, requiredEvidence, `Release evidence validator requires ${requiredEvidence}`);
  includes(files.realDeviceProtocol, requiredEvidence, `Real-device protocol covers ${requiredEvidence}`);
}
for (const provider of ["firebase", "radar", "googleMaps", "stripeConnect", "metaFacebook"]) {
  includes(files.evidenceTemplate, provider, `Release evidence template includes ${provider}`);
  includes(files.evidenceValidator, provider, `Release evidence validator requires ${provider}`);
}
for (const requiredProviderVariable of [
  "FIREBASE_ANDROID_CONFIG_BASE64",
  "FIREBASE_IOS_CONFIG_BASE64",
  "GOOGLE_MAPS_API_KEY",
  "SGM_GOOGLE_MAPS_ANDROID_API_KEY",
  "SGM_GOOGLE_MAPS_IOS_API_KEY",
  "RADAR_WEBHOOK_SECRET",
  "SGM_RADAR_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SGM_FACEBOOK_APP_ID",
  "SGM_FACEBOOK_CLIENT_TOKEN",
]) {
  includes(files.providerValidator, requiredProviderVariable, `Provider validator checks ${requiredProviderVariable}`);
  includes(files.releaseEvidenceWorkflow, requiredProviderVariable, `Release evidence workflow passes ${requiredProviderVariable}`);
}
includes(files.evidenceSchema, "Release Evidence Manifest", "Release evidence schema exists");
includes(files.realDeviceProtocol, "Release Evidence Gate", "Real-device protocol names release gate");
includes(files.releaseEvidenceWorkflow, "validate:release-evidence", "Release evidence workflow validates real manifests");
includes(files.releaseEvidenceWorkflow, "validate:provider-readiness", "Release evidence workflow validates provider readiness");
includes(files.releaseReadinessWorkflow, "scripts/firebase-android-config.mjs", "Release readiness reruns when Firebase live-smoke config helper changes");
includes(files.releaseReadinessWorkflow, "test:provider-readiness", "Release readiness validates provider checks");
includes(files.releaseReadinessWorkflow, "test:release-evidence-template", "Release readiness validates evidence template");
includes(files.providerValidator, "STRIPE_WEBHOOK_SECRET", "Provider readiness validates Stripe webhook secret");
includes(files.packageJson, "test:stripe-webhook-flow", "Package scripts expose Stripe webhook flow emulator test");
includes(files.packageJson, "smoke:live-backend-flow", "Package scripts expose live backend flow smoke test");
includes(files.packageJson, "smoke:live-operations-flow", "Package scripts expose live operations flow smoke test");
includes(files.backendCiWorkflow, "test:stripe-webhook-flow", "Backend CI validates Stripe webhook flow");
includes(files.nativeCiWorkflow, "workflow_dispatch", "Native CI can be launched manually for Android flow verification");
includes(files.nativeCiWorkflow, "connectedDebugAndroidTest", "Native CI runs connected Android UI tests");
includes(files.nativeCiWorkflow, "reactivecircus/android-emulator-runner", "Native CI provisions a GitHub-hosted Android emulator");
includes(files.nativeCiWorkflow, "android-connected-ui-test-results", "Native CI uploads Android UI test artifacts");

console.log("Store readiness static checks passed.");

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), `${message}: missing ${needle}`);
}

function excludes(haystack, needle, message) {
  assert.ok(!haystack.includes(needle), `${message}: unexpected ${needle}`);
}
