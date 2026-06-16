#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  requiredAuditEvidence,
  requiredAutomatedFlowEvidence,
  requiredDeviceScenarios,
  requiredProviders,
  requiredStoreEvidence,
} from "./release-evidence-requirements.mjs";

const { manifestPath, allowPlaceholders } = parseArgs(process.argv.slice(2));
const manifestDir = dirname(resolve(manifestPath));
const errors = [];

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`Cannot read release evidence manifest at ${manifestPath}: ${formatError(error)}`);
}

validateManifest(manifest);

if (errors.length > 0) {
  fail(`Release evidence manifest is not valid:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

console.log(`Release evidence manifest validated: ${manifestPath}`);

function validateManifest(data) {
  requireString(data.manifestVersion, "manifestVersion");
  requireString(data.releaseCandidate, "releaseCandidate");
  requireString(data.generatedAt, "generatedAt");
  requireString(data.owner, "owner");
  if (!allowPlaceholders && data.template === true) {
    errors.push("template must be false or omitted for a real release evidence manifest");
  }

  validateProviders(data.providerProductionReadiness);
  validateAutomatedFlowEvidence(data.automatedUserFlowEvidence);
  validateDeviceRuns(data.realDeviceRuns);
  validateStoreEvidence(data.storeReviewEvidence);
  validateAuditEvidence(data.safetyAuditEvidence);
}

function validateProviders(providers) {
  requireObject(providers, "providerProductionReadiness");
  for (const providerId of requiredProviders) {
    const provider = providers?.[providerId];
    const path = `providerProductionReadiness.${providerId}`;
    requireObject(provider, path);
    requireString(provider?.environment, `${path}.environment`);
    requireString(provider?.status, `${path}.status`);
    requireString(provider?.checkedAt, `${path}.checkedAt`);
    requireString(provider?.checkedBy, `${path}.checkedBy`);
    if (!allowPlaceholders && provider?.status !== "production-configured") {
      errors.push(`${path}.status must be production-configured`);
    }
    validateEvidenceRefs(provider?.evidenceRefs, `${path}.evidenceRefs`);
    rejectSecretFields(provider, path);
  }
}

function validateAutomatedFlowEvidence(flowEvidence) {
  requireObject(flowEvidence, "automatedUserFlowEvidence");
  validateEvidenceItems(
    flowEvidence?.items,
    "automatedUserFlowEvidence.items",
    requiredAutomatedFlowEvidence,
    "passed",
  );
}

function validateDeviceRuns(runs) {
  requireArray(runs, "realDeviceRuns");
  for (const platform of ["ios", "android"]) {
    const platformRuns = Array.isArray(runs) ? runs.filter((run) => run?.platform === platform) : [];
    if (platformRuns.length === 0) {
      errors.push(`realDeviceRuns must include at least one ${platform} real-device run`);
      continue;
    }
    const covered = new Set();
    for (const [runIndex, run] of platformRuns.entries()) {
      const path = `realDeviceRuns.${platform}[${runIndex}]`;
      requireString(run.deviceModel, `${path}.deviceModel`);
      requireString(run.osVersion, `${path}.osVersion`);
      requireString(run.appBuild, `${path}.appBuild`);
      requireString(run.tester, `${path}.tester`);
      requireString(run.completedAt, `${path}.completedAt`);
      validateEvidenceRefs(run.evidenceRefs, `${path}.evidenceRefs`);
      requireArray(run.scenarios, `${path}.scenarios`);
      for (const [scenarioIndex, scenario] of (run.scenarios ?? []).entries()) {
        const scenarioPath = `${path}.scenarios[${scenarioIndex}]`;
        requireString(scenario.id, `${scenarioPath}.id`);
        requireString(scenario.status, `${scenarioPath}.status`);
        requireString(scenario.observedResult, `${scenarioPath}.observedResult`);
        validateEvidenceRefs(scenario.evidenceRefs, `${scenarioPath}.evidenceRefs`);
        if (!allowPlaceholders && scenario.status !== "passed") {
          errors.push(`${scenarioPath}.status must be passed`);
        }
        if (scenario.id) covered.add(scenario.id);
      }
    }
    for (const scenarioId of requiredDeviceScenarios) {
      if (!covered.has(scenarioId)) {
        errors.push(`${platform} real-device evidence is missing scenario ${scenarioId}`);
      }
    }
  }
}

function validateStoreEvidence(storeEvidence) {
  requireObject(storeEvidence, "storeReviewEvidence");
  validateEvidenceItems(storeEvidence?.items, "storeReviewEvidence.items", requiredStoreEvidence);
}

function validateAuditEvidence(auditEvidence) {
  requireObject(auditEvidence, "safetyAuditEvidence");
  validateEvidenceItems(auditEvidence?.items, "safetyAuditEvidence.items", requiredAuditEvidence);
}

function validateEvidenceItems(items, path, requiredIds, expectedStatus = "accepted") {
  requireArray(items, path);
  const byId = new Map();
  for (const [index, item] of (items ?? []).entries()) {
    const itemPath = `${path}[${index}]`;
    requireString(item.id, `${itemPath}.id`);
    requireString(item.status, `${itemPath}.status`);
    requireString(item.description, `${itemPath}.description`);
    validateEvidenceRefs(item.evidenceRefs, `${itemPath}.evidenceRefs`);
    if (!allowPlaceholders && item.status !== expectedStatus) {
      errors.push(`${itemPath}.status must be ${expectedStatus}`);
    }
    if (item.id) byId.set(item.id, item);
  }
  for (const requiredId of requiredIds) {
    if (!byId.has(requiredId)) {
      errors.push(`${path} is missing ${requiredId}`);
    }
  }
}

function validateEvidenceRefs(refs, path) {
  requireArray(refs, path);
  if (Array.isArray(refs) && refs.length === 0) {
    errors.push(`${path} must include at least one artifact reference`);
  }
  for (const [index, ref] of (refs ?? []).entries()) {
    const refPath = `${path}[${index}]`;
    requireString(ref, refPath);
    if (typeof ref !== "string") continue;
    if (allowPlaceholders) continue;
    if (isPlaceholder(ref)) {
      errors.push(`${refPath} contains placeholder text`);
      continue;
    }
    if (isUrl(ref)) continue;
    const artifactPath = isAbsolute(ref) ? ref : resolve(manifestDir, ref);
    if (!existsSync(artifactPath)) {
      errors.push(`${refPath} does not exist: ${artifactPath}`);
    }
  }
}

function rejectSecretFields(value, path) {
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    if (/(secret|token|key|password|credential)/i.test(key) && key !== "checkedBy") {
      errors.push(`${path}.${key} must not be included in release evidence; cite a secret-manager proof instead`);
    }
  }
}

function requireObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object`);
  }
}

function requireArray(value, path) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
  }
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
    return;
  }
  if (!allowPlaceholders && isPlaceholder(value)) {
    errors.push(`${path} contains placeholder text`);
  }
}

function isUrl(value) {
  return /^https:\/\/[^\s]+$/i.test(value);
}

function isPlaceholder(value) {
  return /\b(TODO|TBD|PLACEHOLDER|PENDING|EXAMPLE|SAMPLE|REPLACE_ME)\b/i.test(value);
}

function parseArgs(args) {
  const allowPlaceholdersFlag = "--allow-placeholders";
  const allow = args.includes(allowPlaceholdersFlag);
  const path = args.find((arg) => !arg.startsWith("--")) ?? "docs/release/evidence-manifest.json";
  return { manifestPath: path, allowPlaceholders: allow };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
