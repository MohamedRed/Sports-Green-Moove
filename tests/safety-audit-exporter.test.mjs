import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildSafetyAuditExport } from "../scripts/lib/safety-audit-export.mjs";

const tmpDir = mkdtempSync(join(tmpdir(), "sgm-safety-exporter-"));

try {
  const exportJson = buildSafetyAuditExport({
    projectId: "sports-green-moove-prod",
    exportedAt: "2026-06-17T12:00:00.000Z",
    rideSessions: [{
      id: "rideSessionRealId",
      data: {
        tripId: "tripRealId",
        bookingIds: ["bookingRealId"],
        driverUserId: "driverRealUid",
        childUserIds: ["childRealUid"],
        status: "completed",
        stripeWebhookSecret: "whsec_should_not_leave_process",
        passengers: [{
          bookingId: "bookingRealId",
          childId: "childRealUid",
          parentUserId: "parentRealUid",
          label: "Real Child Name",
          pickupStatus: "pickedUp",
          dropoffStatus: "droppedOff",
        }],
      },
      auditEvents: [
        {
          id: "manual_pickup_bookingRealId_childRealUid",
          data: {
            source: "manual",
            eventType: "passengerPickup",
            action: "pickup",
            bookingId: "bookingRealId",
            childId: "childRealUid",
            userId: "driverRealUid",
            note: "Private note",
          },
        },
        {
          id: "manual_dropoff_bookingRealId_childRealUid",
          data: {
            source: "manual",
            eventType: "passengerDropoff",
            action: "dropoff",
            bookingId: "bookingRealId",
            childId: "childRealUid",
            userId: "driverRealUid",
          },
        },
        {
          id: "radarWebhookEventRealId",
          data: {
            source: "radar",
            eventType: "tripArrived",
            action: "arrived",
            radarStatus: "arrived",
            userId: "driverRealUid",
          },
        },
      ],
    }],
    liveTrips: {
      rideSessionRealId: {
        vehicle: {
          userId: "driverRealUid",
          source: "nativeFallback",
          lat: 50.80112,
          lng: 4.39731,
          accuracyM: 12,
        },
        children: {
          childRealUid: {
            userId: "childRealUid",
            source: "nativeFallback",
            lat: 50.79244,
            lng: 4.41198,
          },
        },
      },
    },
    childProfiles: [{
      id: "childRealUid",
      data: {
        guardianConsent: true,
        trackingEnabled: true,
        guardianUserIds: ["parentRealUid"],
        displayName: "Real Child Name",
        email: "child@example.invalid",
      },
    }],
    rewardLedger: [{
      id: "pi_real_ridePayment_parentRealUid",
      data: {
        type: "ridePayment",
        amountCents: -500,
        currency: "eur",
        userId: "parentRealUid",
        sourceId: "pi_real",
        bookingId: "bookingRealId",
        tripId: "tripRealId",
      },
    }],
    reports: [{
      id: "stripe_evt_real",
      data: {
        type: "stripeWebhook",
        eventType: "payment_intent.succeeded",
        eventId: "evt_real",
        reconciliationStatus: "paymentReconciled",
        apiKey: "sk_liv...cess",
      },
    }],
  });

  const exportText = JSON.stringify(exportJson, null, 2);
  for (const forbidden of [
    "rideSessionRealId",
    "bookingRealId",
    "childRealUid",
    "driverRealUid",
    "parentRealUid",
    "Real Child Name",
    "child@example.invalid",
    "whsec_should_not_leave_process",
    "sk_liv...cess",
    "50.80112",
    "4.39731",
  ]) {
    assert.equal(exportText.includes(forbidden), false, `Export must not include ${forbidden}.`);
  }

  const exportPath = join(tmpDir, "safety-audit-export.json");
  writeFileSync(exportPath, `${exportText}\n`);
  const report = JSON.parse(
    execFileSync(process.execPath, ["scripts/validate-safety-audit-export.mjs", exportPath, "--json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(report.ok, true, "Sanitized exporter output should satisfy the safety-audit validator.");

  const packageJson = read("package.json");
  const releaseReadiness = read(".github/workflows/release-readiness.yml");
  const liveBackendSmoke = read("scripts/live-backend-flow-smoke.mjs");
  const liveSmokeSafetyAudit = read("scripts/lib/live-smoke-safety-audit.mjs");
  includes(packageJson, "export:safety-audit-evidence", "Package scripts expose the safety-audit exporter.");
  includes(packageJson, "test:safety-audit-exporter", "Package scripts expose the exporter tests.");
  includes(releaseReadiness, "scripts/export-safety-audit-evidence.mjs", "Release Readiness watches the exporter.");
  includes(releaseReadiness, "scripts/lib/safety-audit-export.mjs", "Release Readiness watches exporter helpers.");
  includes(releaseReadiness, "tests/safety-audit-exporter.test.mjs", "Release Readiness watches exporter tests.");
  includes(releaseReadiness, "test:safety-audit-exporter", "Release Readiness runs exporter tests.");
  includes(liveBackendSmoke, "--safety-audit-output", "Live backend smoke can write a disposable safety-audit export before cleanup.");
  includes(liveBackendSmoke, "writeLiveSmokeSafetyAuditExport", "Live backend smoke can call the disposable safety-audit export helper.");
  includes(liveSmokeSafetyAudit, "buildSafetyAuditExport", "Live smoke safety-audit helper uses the sanitized exporter.");
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log("Safety audit exporter checks passed.");

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message);
}
