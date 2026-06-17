import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = read("docs/release/privacy-data-safety.md");
const appStoreAnswers = read("docs/release/evidence/app-store-privacy-answers.md");
const googlePlayAnswers = read("docs/release/evidence/google-play-data-safety-answers.md");
const manifest = JSON.parse(read("docs/release/evidence-manifest.json"));

for (const text of [
  "does not sell personal data",
  "advertising or third-party tracking",
  "guardian consent",
  "active ride",
  "Stripe",
  "Firebase",
  "Radar",
  "Google Maps Platform",
  "Meta",
]) {
  includes(source, text, `Privacy source includes ${text}`);
}

for (const text of [
  "Official reference: https://developer.apple.com/app-store/app-privacy-details/",
  "Data used to track users: No.",
  "Location - Precise Location",
  "Financial Info - Payment Info",
  "Child rides require guardian consent",
  "Stripe Connect",
]) {
  includes(appStoreAnswers, text, `App Store answers include ${text}`);
}

for (const text of [
  "Official reference: https://support.google.com/googleplay/android-developer/answer/10787469",
  "Is all collected user data encrypted in transit? Yes.",
  "Can users request that their data is deleted? Yes.",
  "Location - Precise location",
  "Financial info - Payment info",
  "Background location is limited to active ride sessions.",
]) {
  includes(googlePlayAnswers, text, `Google Play answers include ${text}`);
}

const storeEvidence = Object.fromEntries(
  manifest.storeReviewEvidence.items.map((item) => [item.id, item]),
);

assert.equal(storeEvidence.app_store_privacy_answers.status, "accepted");
assert.deepEqual(storeEvidence.app_store_privacy_answers.evidenceRefs, [
  "evidence/app-store-privacy-answers.md",
  "privacy-data-safety.md",
]);

assert.equal(storeEvidence.google_play_data_safety_answers.status, "accepted");
assert.deepEqual(storeEvidence.google_play_data_safety_answers.evidenceRefs, [
  "evidence/google-play-data-safety-answers.md",
  "privacy-data-safety.md",
]);

assert.equal(storeEvidence.privacy_policy_url.status, "pending");

console.log("Store privacy answer checks passed.");

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), `${message}: missing ${needle}`);
}
