import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

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

console.log("Release evidence template checks passed.");
