import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const output = execFileSync(
  process.execPath,
  ["scripts/report-release-gaps.mjs", "--json"],
  {
    encoding: "utf8",
    env: {
      HOME: process.env.HOME,
      PATH: process.env.PATH,
    },
  },
);
const report = JSON.parse(output);

assert.equal(report.ok, false, "Current release gap report must not claim public-launch completion.");
assert.equal(report.manifest.exists, false, "Real release evidence manifest is intentionally absent until manual evidence exists.");
assert.deepEqual(report.automatedFlowEvidence.missing, [], "Automated user-flow evidence should be complete.");

for (const providerVariable of [
  "SGM_GOOGLE_REVERSED_CLIENT_ID",
  "SGM_FACEBOOK_APP_ID",
  "SGM_FACEBOOK_CLIENT_TOKEN",
]) {
  assert.ok(
    report.providerEnvironment.missing.includes(providerVariable),
    `Provider environment should report missing ${providerVariable}.`,
  );
}

for (const platform of ["ios", "android"]) {
  assert.equal(report.realDeviceRuns.byPlatform[platform].runCount, 0);
  assert.ok(
    report.realDeviceRuns.byPlatform[platform].missing.includes("locked_screen_tracking"),
    `${platform} real-device evidence should report missing locked-screen tracking.`,
  );
  assert.ok(
    report.realDeviceRuns.byPlatform[platform].missing.includes("firebase_native_fallback"),
    `${platform} real-device evidence should report missing native fallback proof.`,
  );
}

assert.ok(
  report.storeReviewEvidence.missing.includes("permission_education_screenshot"),
  "Store-review evidence should report missing permission education screenshots.",
);
assert.ok(
  report.safetyAuditEvidence.missing.includes("payment_reconciliation_event"),
  "Safety-audit evidence should report missing payment reconciliation exports.",
);

console.log("Release gap report checks passed.");
