import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const node = process.execPath;
const validator = "scripts/validate-release-evidence.mjs";
const template = "docs/release/evidence-manifest.example.json";

execFileSync(node, [validator, "--allow-placeholders", template], { stdio: "pipe" });

let rejectedAsRealEvidence = false;
try {
  execFileSync(node, [validator, template], { stdio: "pipe" });
} catch (error) {
  rejectedAsRealEvidence = true;
  assert.match(String(error.stderr), /template must be false or omitted/);
}
assert.equal(rejectedAsRealEvidence, true, "The example manifest must not pass as real release evidence.");

const withoutAutomatedEvidence = JSON.parse(readFileSync(template, "utf8"));
delete withoutAutomatedEvidence.automatedUserFlowEvidence;
const invalidPath = join(mkdtempSync(join(tmpdir(), "sgm-release-evidence-")), "missing-automated.json");
writeFileSync(invalidPath, JSON.stringify(withoutAutomatedEvidence, null, 2));

assertValidatorFailure(
  ["--allow-placeholders", invalidPath],
  /automatedUserFlowEvidence/,
  "Release evidence must include automated user-flow evidence.",
);

const withoutAndroidLockedScreen = JSON.parse(readFileSync(template, "utf8"));
const androidRun = withoutAndroidLockedScreen.realDeviceRuns.find((run) => run.platform === "android");
androidRun.scenarios = androidRun.scenarios.filter((scenario) => scenario.id !== "locked_screen_tracking");
const missingScenarioPath = join(mkdtempSync(join(tmpdir(), "sgm-release-evidence-")), "missing-android-scenario.json");
writeFileSync(missingScenarioPath, JSON.stringify(withoutAndroidLockedScreen, null, 2));

assertValidatorFailure(
  ["--allow-placeholders", missingScenarioPath],
  /android real-device evidence is missing scenario locked_screen_tracking/,
  "Release evidence must include every required Android real-device scenario.",
);

const withSecretField = JSON.parse(readFileSync(template, "utf8"));
withSecretField.providerProductionReadiness.stripeConnect.secretKey = "sk_live_do_not_commit";
const secretPath = join(mkdtempSync(join(tmpdir(), "sgm-release-evidence-")), "secret-field.json");
writeFileSync(secretPath, JSON.stringify(withSecretField, null, 2));

assertValidatorFailure(
  ["--allow-placeholders", secretPath],
  /stripeConnect\.secretKey must not be included/,
  "Release evidence must reject committed provider secrets.",
);

console.log("Release evidence template checks passed.");

function assertValidatorFailure(args, pattern, message) {
  let failed = false;
  try {
    execFileSync(node, [validator, ...args], { stdio: "pipe" });
  } catch (error) {
    failed = true;
    assert.match(String(error.stderr), pattern);
  }
  assert.equal(failed, true, message);
}
