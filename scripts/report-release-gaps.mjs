#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  requiredAuditEvidence,
  requiredAutomatedFlowEvidence,
  requiredDeviceScenarios,
  requiredProviderEnvironmentVariables,
  requiredProviders,
  requiredStoreEvidence,
} from "./release-evidence-requirements.mjs";

const { manifestPath, automatedEvidencePath, json } = parseArgs(process.argv.slice(2));
const manifest = readJsonIfExists(manifestPath);
const automatedEvidence = readJsonIfExists(automatedEvidencePath);
const report = buildReport(manifest, automatedEvidence);

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printTextReport(report);
}

function buildReport(manifestResult, automatedResult) {
  const manifest = manifestResult.data;
  const automated = automatedResult.data;
  const automatedItems = automated?.items ?? manifest?.automatedUserFlowEvidence?.items ?? [];
  const providerEnvironment = providerEnvironmentGaps();
  const providerReadiness = providerReadinessGaps(manifest?.providerProductionReadiness);
  const automatedFlowEvidence = itemGaps(automatedItems, requiredAutomatedFlowEvidence);
  const realDeviceRuns = realDeviceGaps(manifest?.realDeviceRuns);
  const storeReviewEvidence = itemGaps(manifest?.storeReviewEvidence?.items, requiredStoreEvidence);
  const safetyAuditEvidence = itemGaps(manifest?.safetyAuditEvidence?.items, requiredAuditEvidence);

  return {
    ok: [
      providerEnvironment,
      providerReadiness,
      automatedFlowEvidence,
      realDeviceRuns,
      storeReviewEvidence,
      safetyAuditEvidence,
    ].every((section) => section.ok),
    manifest: manifestResult,
    automatedEvidence: automatedResult,
    providerEnvironment,
    providerReadiness,
    automatedFlowEvidence,
    realDeviceRuns,
    storeReviewEvidence,
    safetyAuditEvidence,
  };
}

function providerEnvironmentGaps() {
  const present = requiredProviderEnvironmentVariables.filter((name) => hasEnv(name));
  const missing = requiredProviderEnvironmentVariables.filter((name) => !hasEnv(name));
  return {
    ok: missing.length === 0,
    required: requiredProviderEnvironmentVariables,
    present,
    missing,
  };
}

function providerReadinessGaps(providers) {
  const configured = requiredProviders.filter((provider) => {
    return providers?.[provider]?.status === "production-configured";
  });
  return {
    ok: configured.length === requiredProviders.length,
    required: requiredProviders,
    configured,
    missing: requiredProviders.filter((provider) => !configured.includes(provider)),
  };
}

function itemGaps(items = [], requiredIds) {
  const passed = new Set(
    items
      .filter((item) => item?.status === "passed" || item?.status === "accepted")
      .map((item) => item.id),
  );
  const missing = requiredIds.filter((id) => !passed.has(id));
  return {
    ok: missing.length === 0,
    required: requiredIds,
    passed: requiredIds.filter((id) => passed.has(id)),
    missing,
  };
}

function realDeviceGaps(runs = []) {
  const byPlatform = {};
  for (const platform of ["ios", "android"]) {
    const platformRuns = Array.isArray(runs) ? runs.filter((run) => run?.platform === platform) : [];
    const passed = new Set(
      platformRuns.flatMap((run) => {
        return (run.scenarios ?? [])
          .filter((scenario) => scenario?.status === "passed")
          .map((scenario) => scenario.id);
      }),
    );
    const missing = requiredDeviceScenarios.filter((id) => !passed.has(id));
    byPlatform[platform] = {
      ok: platformRuns.length > 0 && missing.length === 0,
      runCount: platformRuns.length,
      required: requiredDeviceScenarios,
      passed: requiredDeviceScenarios.filter((id) => passed.has(id)),
      missing,
    };
  }
  return {
    ok: Object.values(byPlatform).every((platform) => platform.ok),
    byPlatform,
  };
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return { path, exists: false, data: null };
  try {
    return { path, exists: true, data: JSON.parse(readFileSync(path, "utf8")) };
  } catch (error) {
    return { path, exists: true, parseError: formatError(error), data: null };
  }
}

function latestAutomatedEvidencePath() {
  const evidenceDir = "docs/release/evidence";
  if (!existsSync(evidenceDir)) return join(evidenceDir, "automated-user-flow-evidence-2026-06-16.json");
  const candidates = readdirSync(evidenceDir)
    .filter((name) => /^automated-user-flow-evidence-.*\.json$/.test(name))
    .sort();
  return candidates.length > 0 ? join(evidenceDir, candidates.at(-1)) : join(evidenceDir, "automated-user-flow-evidence-2026-06-16.json");
}

function printTextReport(report) {
  console.log(report.ok ? "Release evidence gaps: none" : "Release evidence gaps remain");
  printList("Missing provider env vars", report.providerEnvironment.missing);
  printList("Missing provider readiness entries", report.providerReadiness.missing);
  printList("Missing automated evidence", report.automatedFlowEvidence.missing);
  for (const [platform, state] of Object.entries(report.realDeviceRuns.byPlatform)) {
    printList(`Missing ${platform} real-device scenarios`, state.missing);
  }
  printList("Missing store-review evidence", report.storeReviewEvidence.missing);
  printList("Missing safety-audit evidence", report.safetyAuditEvidence.missing);
}

function printList(label, items) {
  console.log(`${label}: ${items.length === 0 ? "none" : items.join(", ")}`);
}

function hasEnv(name) {
  return typeof process.env[name] === "string" && process.env[name].trim().length > 0;
}

function parseArgs(args) {
  return {
    manifestPath: valueAfter(args, "--manifest") ?? "docs/release/evidence-manifest.json",
    automatedEvidencePath: valueAfter(args, "--automated-evidence") ?? latestAutomatedEvidencePath(),
    json: args.includes("--json"),
  };
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${flag} requires a value`);
    process.exit(1);
  }
  return value;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
