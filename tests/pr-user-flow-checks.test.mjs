import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { requiredUserFlowChecks } from "../scripts/release-evidence-requirements.mjs";

const tmpDir = mkdtempSync(join(tmpdir(), "sgm-pr-checks-"));

try {
  const passingInput = join(tmpDir, "passing.json");
  writeFileSync(passingInput, JSON.stringify(checkRollup()));

  const passing = runVerifier(passingInput);
  assert.equal(passing.status, 0, passing.stderr);
  const passingReport = JSON.parse(passing.stdout);
  assert.equal(passingReport.ok, true, "Passing check rollup should be accepted.");
  assert.deepEqual(passingReport.missing, [], "Passing check rollup should not miss required checks.");
  assert.deepEqual(passingReport.incomplete, [], "Passing check rollup should not contain incomplete checks.");
  assert.deepEqual(passingReport.failed, [], "Passing check rollup should not contain failed checks.");

  const commitsOnlyInput = join(tmpDir, "commits-only.json");
  const commitsOnlyRollup = checkRollup();
  delete commitsOnlyRollup.headRefOid;
  writeFileSync(commitsOnlyInput, JSON.stringify(commitsOnlyRollup));
  const commitsOnly = runVerifier(commitsOnlyInput);
  assert.equal(commitsOnly.status, 0, commitsOnly.stderr);
  assert.equal(
    JSON.parse(commitsOnly.stdout).headRefOid,
    "200080f92934e2aa49c775837239dba4962cb2cc",
    "Verifier should read the latest PR head from commits when gh does not expose headRefOid.",
  );

  const workflowLessInput = join(tmpDir, "workflow-less.json");
  const workflowLessRollup = checkRollup();
  workflowLessRollup.statusCheckRollup = workflowLessRollup.statusCheckRollup.map((check) => {
    const { workflowName: _workflowName, ...rest } = check;
    return rest;
  });
  writeFileSync(workflowLessInput, JSON.stringify(workflowLessRollup));
  const workflowLess = runVerifier(workflowLessInput);
  assert.equal(workflowLess.status, 0, workflowLess.stderr);
  assert.equal(
    JSON.parse(workflowLess.stdout).ok,
    true,
    "Verifier should accept live gh statusCheckRollup entries that include check names but no workflowName field.",
  );

  const failingInput = join(tmpDir, "failing.json");
  writeFileSync(
    failingInput,
    JSON.stringify(
      checkRollup({
        workflowName: "Native CI",
        name: "Android native UI tests",
        conclusion: "FAILURE",
      }),
    ),
  );

  const failing = runVerifier(failingInput);
  assert.equal(failing.status, 1, "Failing Android UI check should reject the PR flow report.");
  const failingReport = JSON.parse(failing.stdout);
  assert.equal(failingReport.ok, false);
  assert.deepEqual(failingReport.failed, ["Native CI / Android native UI tests"]);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log("PR user-flow check verifier tests passed.");

function runVerifier(input) {
  return spawnSync(process.execPath, ["scripts/verify-pr-user-flow-checks.mjs", "--input", input, "--json"], {
    encoding: "utf8",
    env: {
      HOME: process.env.HOME,
      PATH: process.env.PATH,
    },
  });
}

function checkRollup(overrides = {}) {
  return {
    headRefOid: "200080f92934e2aa49c775837239dba4962cb2cc",
    commits: [
      { oid: "1111111111111111111111111111111111111111" },
      { oid: "200080f92934e2aa49c775837239dba4962cb2cc" },
    ],
    url: "https://github.com/MohamedRed/Sports-Green-Moove/pull/1",
    statusCheckRollup: requiredUserFlowChecks.map((check) => ({
      __typename: "CheckRun",
      workflowName: check.workflowName,
      name: check.name,
      status: "COMPLETED",
      conclusion: check.acceptableConclusions.includes("SUCCESS") ? "SUCCESS" : check.acceptableConclusions[0],
      detailsUrl: `https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/${slug(check.name)}`,
      ...matchingOverride(check, overrides),
    })),
  };
}

function matchingOverride(check, overrides) {
  if (check.workflowName === overrides.workflowName && check.name === overrides.name) {
    return overrides;
  }
  return {};
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
