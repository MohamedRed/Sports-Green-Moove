import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const files = {
  androidManifest: read("android/app/src/main/AndroidManifest.xml"),
  androidStrings: read("android/app/src/main/res/values/strings.xml"),
  iosProject: read("ios/project.yml"),
  iosPrivacy: read("ios/Sources/SportsGreenMooveApp/Resources/PrivacyInfo.xcprivacy"),
  dataSafety: read("docs/release/privacy-data-safety.md"),
  storeReadiness: read("docs/release/store-readiness.md"),
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
]) {
  includes(files.iosProject, key, `iOS project declares ${key}`);
}
includes(files.iosProject, "course active", "iOS usage strings limit tracking to active rides");

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
  "https://radar.com/privacy",
  "https://policies.google.com/privacy",
  "https://stripe.com/privacy",
]) {
  includes(files.dataSafety, processorUrl, `Data-safety doc includes ${processorUrl}`);
}
includes(files.dataSafety, "does not sell personal data", "Data-safety doc states no sale of personal data");
includes(files.dataSafety, "guardian consent", "Data-safety doc covers guardian consent");
includes(files.storeReadiness, "privacy-data-safety.md", "Store checklist links data-safety source");

console.log("Store readiness static checks passed.");

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), `${message}: missing ${needle}`);
}
