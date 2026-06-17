import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { requiredProviderEnvironmentVariables } from "../scripts/release-evidence-requirements.mjs";

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
assert.equal(report.manifest.exists, true, "In-progress release evidence manifest should be read.");
assert.equal(report.manifest.data.manifestStatus, "in-progress", "Release evidence manifest must not claim completion.");
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

const tmpDir = mkdtempSync(join(tmpdir(), "sgm-release-gaps-"));
try {
  const configuredSecretNames = requiredProviderEnvironmentVariables.filter((name) => {
    return ![
      "SGM_GOOGLE_REVERSED_CLIENT_ID",
      "SGM_FACEBOOK_APP_ID",
      "SGM_FACEBOOK_CLIENT_TOKEN",
    ].includes(name);
  });
  const inventoryPath = join(tmpDir, "github-secrets.json");
  writeFileSync(
    inventoryPath,
    JSON.stringify(configuredSecretNames.map((name) => ({ name, updatedAt: "2026-06-14T00:00:00Z" }))),
  );

  const inventoryReport = JSON.parse(
    execFileSync(process.execPath, ["scripts/report-release-gaps.mjs", "--json", "--secret-inventory", inventoryPath], {
      encoding: "utf8",
      env: {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
      },
    }),
  );

  assert.equal(inventoryReport.secretInventory.exists, true, "Secret inventory file should be read.");
  assert.ok(
    inventoryReport.providerEnvironment.presentFromSecretInventory.includes("STRIPE_WEBHOOK_SECRET"),
    "Provider environment should count configured GitHub secret names.",
  );
  assert.deepEqual(
    inventoryReport.providerEnvironment.missing,
    ["SGM_GOOGLE_REVERSED_CLIENT_ID", "SGM_FACEBOOK_APP_ID", "SGM_FACEBOOK_CLIENT_TOKEN"],
    "Secret inventory mode should leave only missing Google and Meta OAuth secret names.",
  );
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
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
  report.storeReviewEvidence.passed.includes("permission_education_screenshot"),
  "Store-review evidence should count generated permission education screenshot evidence.",
);
assert.ok(
  report.storeReviewEvidence.passed.includes("active_ride_tracking_screenshot"),
  "Store-review evidence should count generated active ride screenshot evidence.",
);
assert.ok(
  report.storeReviewEvidence.missing.includes("privacy_policy_url"),
  "Store-review evidence should still report missing published privacy-policy URL.",
);
assert.ok(
  report.storeReviewEvidence.missing.includes("guardian_consent_copy"),
  "Store-review evidence should still report missing guardian consent copy.",
);
assert.ok(
  !report.storeReviewEvidence.missing.includes("permission_education_screenshot"),
  "Generated permission education screenshot should no longer be reported missing.",
);
assert.ok(
  report.safetyAuditEvidence.missing.includes("payment_reconciliation_event"),
  "Safety-audit evidence should report missing payment reconciliation exports.",
);

console.log("Release gap report checks passed.");
