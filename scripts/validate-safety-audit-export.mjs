#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { requiredAuditEvidence } from "./release-evidence-requirements.mjs";

const { exportPath, json } = parseArgs(process.argv.slice(2));
const raw = readExport(exportPath);
const records = flattenRecords(raw);
const secretLeaks = findSecretLikeFields(records);
const matches = matchAuditEvidence(records);
const missing = requiredAuditEvidence.filter((id) => !matches[id]);

const report = {
  ok: missing.length === 0 && secretLeaks.length === 0,
  exportPath,
  recordCount: records.length,
  matched: Object.fromEntries(
    requiredAuditEvidence.map((id) => [id, matches[id]?.path ?? null]),
  ),
  missing,
  secretLeaks,
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printTextReport(report);
}

if (!report.ok) process.exit(1);

function readExport(path) {
  if (!existsSync(path)) {
    fail(`Safety audit export does not exist: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Safety audit export is not valid JSON: ${formatError(error)}`);
  }
}

function flattenRecords(value, path = "$", records = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenRecords(item, `${path}[${index}]`, records));
    return records;
  }
  if (!value || typeof value !== "object") return records;

  records.push({ path, value });
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object") {
      flattenRecords(child, `${path}.${key}`, records);
    }
  }
  return records;
}

function matchAuditEvidence(records) {
  const matchers = {
    guardian_consent_event: isGuardianConsentEvent,
    pickup_event: isPickupEvent,
    dropoff_event: isDropoffEvent,
    radar_webhook_event: isRadarWebhookEvent,
    native_fallback_location_event: isNativeFallbackLocationEvent,
    payment_reconciliation_event: isPaymentReconciliationEvent,
  };

  return Object.fromEntries(
    Object.entries(matchers).map(([id, matcher]) => {
      const record = records.find(({ value }) => matcher(value));
      return [id, record ?? null];
    }),
  );
}

function isGuardianConsentEvent(value) {
  return hasTruthy(value.guardianConsent)
    || hasAnyFieldText(value, ["eventType", "action", "type", "status", "description"], [
      "guardianConsent",
      "guardian_consent",
      "guardian consent",
    ]);
}

function isPickupEvent(value) {
  return value.eventType === "passengerPickup"
    || value.action === "pickup"
    || value.pickupStatus === "pickedUp"
    || value.type === "passengerPickedUp";
}

function isDropoffEvent(value) {
  return value.eventType === "passengerDropoff"
    || value.action === "dropoff"
    || value.dropoffStatus === "droppedOff"
    || value.type === "passengerDroppedOff";
}

function isRadarWebhookEvent(value) {
  return value.source === "radar"
    || value.type === "radarWebhook"
    || hasAnyFieldText(value, ["eventType", "action", "type", "radarStatus"], [
      "radarPickup",
      "radarDropoff",
      "radarArrived",
      "radarApproaching",
    ]);
}

function isNativeFallbackLocationEvent(value) {
  return value.source === "nativeFallback";
}

function isPaymentReconciliationEvent(value) {
  const statuses = new Set([
    "paymentReconciled",
    "payoutTransferReconciled",
    "payoutTransferReversed",
  ]);
  return value.type === "stripeWebhook" && statuses.has(value.reconciliationStatus)
    || statuses.has(value.reconciliationStatus)
    || ["ridePayment", "driverEarning", "payout", "refund"].includes(value.type);
}

function findSecretLikeFields(records) {
  const leaks = [];
  for (const record of records) {
    for (const [key, value] of Object.entries(record.value)) {
      if (!/(secret|token|password|credential|privateKey|clientSecret|apiKey)/i.test(key)) continue;
      if (value == null || value === "") continue;
      leaks.push(`${record.path}.${key}`);
    }
  }
  return leaks;
}

function hasTruthy(value) {
  return value === true || value === "true" || value === "accepted";
}

function hasAnyFieldText(value, fields, needles) {
  return fields.some((field) => {
    const text = typeof value[field] === "string" ? value[field].toLowerCase() : "";
    return needles.some((needle) => text.includes(needle.toLowerCase()));
  });
}

function printTextReport(report) {
  if (report.ok) {
    console.log(`Safety audit export validated: ${report.exportPath}`);
    for (const [id, path] of Object.entries(report.matched)) {
      console.log(`- ${id}: ${path}`);
    }
    return;
  }

  console.error(`Safety audit export is incomplete: ${report.exportPath}`);
  if (report.missing.length > 0) {
    console.error(`Missing audit evidence: ${report.missing.join(", ")}`);
  }
  if (report.secretLeaks.length > 0) {
    console.error(`Secret-like fields must be removed: ${report.secretLeaks.join(", ")}`);
  }
}

function parseArgs(args) {
  const json = args.includes("--json");
  const exportPath = args.find((arg) => !arg.startsWith("--"))
    ?? "docs/release/evidence/safety-audit-export.json";
  return { exportPath, json };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
