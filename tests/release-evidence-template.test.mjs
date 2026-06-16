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

let rejectedWithoutAutomatedEvidence = false;
try {
  execFileSync(node, [validator, "--allow-placeholders", invalidPath], { stdio: "pipe" });
} catch (error) {
  rejectedWithoutAutomatedEvidence = true;
  assert.match(String(error.stderr), /automatedUserFlowEvidence/);
}
assert.equal(rejectedWithoutAutomatedEvidence, true, "Release evidence must include automated user-flow evidence.");

console.log("Release evidence template checks passed.");
