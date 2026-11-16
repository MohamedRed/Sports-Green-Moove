import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "yaml";

const node = process.execPath;
const script = "scripts/validate-safety-audit-export.mjs";
const tmpDir = mkdtempSync(join(tmpdir(), "sgm-safety-audit-"));

try {
  const validExport = join(tmpDir, "valid.json");
  writeFileSync(validExport, JSON.stringify({
    rideSessions: [
      {
        id: "ride-1",
        childId: "child-1",
        guardianConsent: true,
        auditEvents: [
          { source: "manual", eventType: "passengerPickup", action: "pickup", bookingId: "booking-1" },
          { source: "manual", eventType: "passengerDropoff", action: "dropoff", bookingId: "booking-1" },
          { source: "radar", eventType: "tripArrived", action: "arrived", radarStatus: "arrived" },
        ],
      },
    ],
    liveTrips: {
      "ride-1": {
        vehicle: { source: "nativeFallback", latitude: 50.85, longitude: 4.35 },
      },
    },
    reports: [
      {
        type: "stripeWebhook",
        eventId: "evt_payment_succeeded",
        reconciliationStatus: "paymentReconciled",
      },
    ],
  }));

  const output = execFileSync(node, [script, validExport, "--json"], { encoding: "utf8" });
  const report = JSON.parse(output);
  assert.equal(report.ok, true);
  assert.equal(report.missing.length, 0);
  assert.ok(report.matched.guardian_consent_event.includes("rideSessions"));
  assert.ok(report.matched.native_fallback_location_event.includes("liveTrips"));
  assert.ok(report.matched.payment_reconciliation_event.includes("reports"));

  const unreconciledExport = join(tmpDir, "unreconciled.json");
  const unreconciled = JSON.parse(readFileSync(validExport, "utf8"));
  unreconciled.rewardLedger = [{ type: "ridePayment", bookingId: "booking-1" }];
  unreconciled.reports = [
    { type: "stripeWebhook", reconciliationStatus: "paymentIncomplete" },
    { type: "customReport", reconciliationStatus: "paymentReconciled" },
  ];
  writeFileSync(unreconciledExport, JSON.stringify(unreconciled));
  assertFailure(
    [script, unreconciledExport],
    /Missing audit evidence: payment_reconciliation_event/,
    "A ledger entry and unrelated or unsuccessful reports cannot prove Stripe reconciliation.",
  );

  const incompleteExport = join(tmpDir, "incomplete.json");
  writeFileSync(incompleteExport, JSON.stringify({
    rideSessions: [{ auditEvents: [{ eventType: "passengerPickup", action: "pickup" }] }],
  }));
  assertFailure(
    [script, incompleteExport],
    /Missing audit evidence: .*dropoff_event.*radar_webhook_event.*native_fallback_location_event.*payment_reconciliation_event/s,
    "Incomplete exports must fail with missing audit event ids.",
  );

  const unsafeExport = join(tmpDir, "unsafe.json");
  writeFileSync(unsafeExport, JSON.stringify({
    rideSessions: [{ guardianConsent: true, stripeWebhookSecret: "whsec_live_value" }],
  }));
  assertFailure(
    [script, unsafeExport],
    /Secret-like fields must be removed: .*stripeWebhookSecret/s,
    "Exports with secret-like fields must fail.",
  );

  const packageJson = read("package.json");
  const releaseReadiness = read(".github/workflows/release-readiness.yml");
  const realDeviceProtocol = read("docs/release/real-device-test-protocol.md");
  const storeReadiness = read("docs/release/store-readiness.md");
  const validator = read(script);

  includes(packageJson, "validate:safety-audit-export", "Package scripts expose safety-audit export validator.");
  includes(packageJson, "test:safety-audit-export", "Package scripts expose safety-audit validator tests.");
  includes(releaseReadiness, "scripts/validate-safety-audit-export.mjs", "Release Readiness watches the safety-audit validator.");
  includes(releaseReadiness, "tests/safety-audit-export.test.mjs", "Release Readiness watches safety-audit validator tests.");
  includes(releaseReadiness, "test:safety-audit-export", "Release Readiness runs safety-audit validator tests.");
  includes(realDeviceProtocol, "validate:safety-audit-export", "Real-device protocol validates safety-audit exports.");
  includes(storeReadiness, "validate:safety-audit-export", "Store checklist documents safety-audit export validation.");
  const releaseGate = parse(read(".github/workflows/release-evidence.yml"));
  const inputs = releaseGate.on.workflow_dispatch.inputs;
  const steps = releaseGate.jobs["release-evidence"].steps;
  assert.equal(inputs.safety_audit_export_path.default, "docs/release/evidence/safety-audit-export.json");
  const auditStep = steps.find(({ name }) => name === "Validate the sanitized safety audit export");
  assert.equal(auditStep.env.SGM_RELEASE_AUDIT_EXPORT_PATH, "${{ inputs.safety_audit_export_path }}");
  assert.equal(auditStep.run, 'npm run validate:safety-audit-export -- "$SGM_RELEASE_AUDIT_EXPORT_PATH"');
  includes(validator, "requiredAuditEvidence", "Safety-audit validator uses shared audit requirements.");
  includes(validator, "guardian_consent_event", "Safety-audit validator checks guardian consent evidence.");
  includes(validator, "native_fallback_location_event", "Safety-audit validator checks native fallback evidence.");
  includes(validator, "payment_reconciliation_event", "Safety-audit validator checks payment reconciliation evidence.");
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log("Safety audit export checks passed.");

function assertFailure(args, pattern, message) {
  let failed = false;
  try {
    execFileSync(node, args, { encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    failed = true;
    assert.match(String(error.stderr), pattern);
  }
  assert.equal(failed, true, message);
}

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message);
}
