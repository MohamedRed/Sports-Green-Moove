#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  requiredAuditEvidence,
  requiredAutomatedFlowEvidence,
  requiredDeviceScenarios,
  postponedSocialAuthEnvironmentVariables,
  requiredProviderEnvironmentVariables,
  requiredProviders,
  requiredStoreEvidence,
} from "./release-evidence-requirements.mjs";

const { manifestPath, automatedEvidencePath, secretInventoryPath, json } = parseArgs(process.argv.slice(2));
const manifest = readJsonIfExists(manifestPath);
const automatedEvidence = readJsonIfExists(automatedEvidencePath);
const secretInventory = readSecretInventoryIfExists(secretInventoryPath);
const report = buildReport(manifest, automatedEvidence, secretInventory);

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printTextReport(report);
}

function buildReport(manifestResult, automatedResult, secretInventoryResult) {
  const manifest = manifestResult.data;
  const automated = automatedResult.data;
  const automatedItems = automated?.items ?? manifest?.automatedUserFlowEvidence?.items ?? [];
  const providerEnvironment = providerEnvironmentGaps(
    secretInventoryResult.names,
    requiredProviderEnvironmentVariables,
  );
  const postponedSocialAuthEnvironment = providerEnvironmentGaps(
    secretInventoryResult.names,
    postponedSocialAuthEnvironmentVariables,
  );
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
    secretInventory: secretInventoryResult,
    providerEnvironment,
    postponedSocialAuthEnvironment,
    providerReadiness,
    automatedFlowEvidence,
    realDeviceRuns,
    storeReviewEvidence,
    safetyAuditEvidence,
  };
}

function providerEnvironmentGaps(secretNames = [], requiredNames) {
  const presentFromEnv = requiredNames.filter((name) => hasEnv(name));
  const presentFromSecretInventory = requiredNames.filter((name) => secretNames.includes(name));
  const presentSet = new Set([...presentFromEnv, ...presentFromSecretInventory]);
  const missing = requiredNames.filter((name) => !presentSet.has(name));
  return {
    ok: missing.length === 0,
    required: requiredNames,
    present: requiredNames.filter((name) => presentSet.has(name)),
    presentFromEnv,
    presentFromSecretInventory,
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

function readSecretInventoryIfExists(path) {
  if (!path) return { path: null, provided: false, exists: false, names: [] };
  if (!existsSync(path)) return { path, provided: true, exists: false, names: [] };
  const raw = readFileSync(path, "utf8");
  try {
    return {
      path,
      provided: true,
      exists: true,
      names: secretNamesFromInventory(raw),
    };
  } catch (error) {
    return {
      path,
      provided: true,
      exists: true,
      parseError: formatError(error),
      names: [],
    };
  }
}

function secretNamesFromInventory(raw) {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return secretNamesFromJson(JSON.parse(trimmed));
  }

  return unique(
    trimmed
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean),
  );
}

function secretNamesFromJson(value) {
  if (Array.isArray(value)) {
    return unique(value.flatMap(secretNameFromEntry));
  }
  if (Array.isArray(value?.names)) {
    return unique(value.names.flatMap(secretNameFromEntry));
  }
  if (Array.isArray(value?.secrets)) {
    return unique(value.secrets.flatMap(secretNameFromEntry));
  }
  throw new Error("Secret inventory must be a JSON array, { names }, { secrets }, or plain text list.");
}

function secretNameFromEntry(entry) {
  if (typeof entry === "string") return [entry];
  if (typeof entry?.name === "string") return [entry.name];
  return [];
}

function unique(items) {
  return [...new Set(items)];
}

function latestAutomatedEvidencePath() {
  const evidenceDir = "docs/release/evidence";
  if (!existsSync(evidenceDir)) return join(evidenceDir, "automated-user-flow-evidence-2026-06-16.json");
  const candidates = readdirSync(evidenceDir)
    .filter((name) => /^automated-user-flow-evidence-.*\.json$/.test(name))
    .sort();
  return candidates.length > 0 ? join(evidenceDir, candidates.at(-1)) : join(evidenceDir, "automated-user-flow-evidence-2026-06-16.json");
}

function latestSecretInventoryPath() {
  const evidenceDir = "docs/release/evidence";
  if (!existsSync(evidenceDir)) return undefined;
  const candidates = readdirSync(evidenceDir)
    .filter((name) => /^provider-secret-inventory-.*\.json$/.test(name))
    .sort();
  return candidates.length > 0 ? join(evidenceDir, candidates.at(-1)) : undefined;
}

function printTextReport(report) {
  console.log(report.ok ? "Release evidence gaps: none" : "Release evidence gaps remain");
  printList("Missing provider env/secret names", report.providerEnvironment.missing);
  printList("Postponed social-auth env/secret names", report.postponedSocialAuthEnvironment.missing);
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
    secretInventoryPath: valueAfter(args, "--secret-inventory") ?? latestSecretInventoryPath(),
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
