import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { requiredDeviceScenarios } from "../scripts/release-evidence-requirements.mjs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(
  packageJson.scripts["browserstack:real-device-evidence"],
  "node scripts/browserstack-real-device-evidence.mjs",
  "Package scripts should expose the BrowserStack evidence normalizer.",
);

assert.ok(existsSync("scripts/browserstack-real-device-evidence.mjs"), "BrowserStack evidence normalizer should exist.");
assert.ok(
  existsSync("docs/ci/browserstack-real-device.yml.template"),
  "BrowserStack workflow must be staged as an inert template until a workflow-scoped token installs it.",
);

const protocol = readFileSync("docs/release/real-device-test-protocol.md", "utf8");
assert.match(protocol, /BrowserStack App Automate/i, "Real-device protocol should document BrowserStack App Automate.");
assert.match(protocol, /browserstack:real-device-evidence/, "Real-device protocol should mention the evidence normalizer command.");

const template = readFileSync("docs/ci/browserstack-real-device.yml.template", "utf8");
for (const secretName of [
  "BROWSERSTACK_USERNAME",
  "BROWSERSTACK_ACCESS_KEY",
  "BROWSERSTACK_ANDROID_APP_URL",
  "BROWSERSTACK_IOS_APP_URL",
]) {
  assert.match(template, new RegExp(secretName), `Workflow template should reference ${secretName}.`);
}
assert.match(template, /scripts\/browserstack-real-device-evidence\.mjs/, "Workflow template should generate normalized evidence.");
assert.doesNotMatch(template, /\.github\/workflows/, "Template should not pretend it is installed as an active workflow.");

const tmpDir = mkdtempSync(join(tmpdir(), "sgm-browserstack-evidence-"));
try {
  const completeInput = join(tmpDir, "complete.json");
  const outputPath = join(tmpDir, "normalized.json");
  writeFileSync(completeInput, JSON.stringify(sampleInput(), null, 2));

  execFileSync(process.execPath, [
    "scripts/browserstack-real-device-evidence.mjs",
    "--input",
    completeInput,
    "--output",
    outputPath,
  ], { encoding: "utf8" });

  const normalized = JSON.parse(readFileSync(outputPath, "utf8"));
  assert.equal(normalized.source, "browserstack-app-automate");
  assert.equal(normalized.realDeviceRuns.length, 2);
  assert.deepEqual(normalized.realDeviceRuns.map((run) => run.platform).sort(), ["android", "ios"]);
  for (const run of normalized.realDeviceRuns) {
    assert.equal(run.tester, "BrowserStack App Automate");
    assert.equal(run.scenarios.length, requiredDeviceScenarios.length);
    assert.ok(run.evidenceRefs.some((ref) => ref.includes("browserstack.com")));
    for (const scenario of run.scenarios) {
      assert.equal(scenario.status, "passed");
      assert.ok(scenario.evidenceRefs.length > 0);
    }
  }

  const incompleteInput = join(tmpDir, "incomplete.json");
  const incomplete = sampleInput();
  incomplete.runs[0].scenarios = incomplete.runs[0].scenarios.filter((scenario) => scenario.id !== "battery_saver");
  writeFileSync(incompleteInput, JSON.stringify(incomplete, null, 2));
  const failed = spawnSync(process.execPath, [
    "scripts/browserstack-real-device-evidence.mjs",
    "--input",
    incompleteInput,
    "--output",
    join(tmpDir, "bad.json"),
  ], { encoding: "utf8" });
  assert.notEqual(failed.status, 0, "Incomplete BrowserStack evidence should fail normalization.");
  assert.match(failed.stderr, /android missing scenario battery_saver/);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log("BrowserStack real-device evidence checks passed.");

function sampleInput() {
  return {
    source: "browserstack-app-automate",
    completedAt: "2026-06-18T16:00:00Z",
    tester: "BrowserStack App Automate",
    appBuild: "codex/implement-plan@50e7793",
    runs: [
      buildRun("android", "Google Pixel 8", "14", "https://app-automate.browserstack.com/dashboard/v2/builds/android-build"),
      buildRun("ios", "iPhone 15", "17", "https://app-automate.browserstack.com/dashboard/v2/builds/ios-build"),
    ],
  };
}

function buildRun(platform, deviceModel, osVersion, buildUrl) {
  return {
    platform,
    deviceModel,
    osVersion,
    evidenceRefs: [buildUrl],
    scenarios: requiredDeviceScenarios.map((id) => ({
      id,
      status: "passed",
      observedResult: `${platform} ${id} passed on BrowserStack real device`,
      evidenceRefs: [`${buildUrl}/sessions/${id}`],
    })),
  };
}
