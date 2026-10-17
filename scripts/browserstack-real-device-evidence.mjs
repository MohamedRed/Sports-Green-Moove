#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { requiredDeviceScenarios } from "./release-evidence-requirements.mjs";

const { inputPath, outputPath } = parseArgs(process.argv.slice(2));
const input = readJson(inputPath);
const normalized = normalizeBrowserStackEvidence(input);
writeJson(outputPath, normalized);
console.log(JSON.stringify({
  ok: true,
  outputPath,
  platforms: normalized.realDeviceRuns.map((run) => run.platform),
  scenarioCount: normalized.realDeviceRuns.reduce((total, run) => total + run.scenarios.length, 0),
}, null, 2));

export function normalizeBrowserStackEvidence(input) {
  const errors = [];
  requireString(input?.completedAt, "completedAt", errors);
  requireString(input?.tester, "tester", errors);
  requireString(input?.appBuild, "appBuild", errors);
  requireArray(input?.runs, "runs", errors);

  const runs = Array.isArray(input?.runs) ? input.runs.map((run, index) => normalizeRun(run, index, input, errors)) : [];
  for (const platform of ["ios", "android"]) {
    if (!runs.some((run) => run.platform === platform)) errors.push(`runs must include ${platform}`);
  }

  if (errors.length > 0) fail(`BrowserStack real-device evidence is not valid:\n${errors.map((error) => `- ${error}`).join("\n")}`);

  return {
    source: "browserstack-app-automate",
    generatedAt: new Date().toISOString(),
    realDeviceRuns: runs,
  };
}

function normalizeRun(run, index, input, errors) {
  const path = `runs[${index}]`;
  const platform = requireEnum(run?.platform, ["ios", "android"], `${path}.platform`, errors);
  requireString(run?.deviceModel, `${path}.deviceModel`, errors);
  requireString(run?.osVersion, `${path}.osVersion`, errors);
  requireArray(run?.evidenceRefs, `${path}.evidenceRefs`, errors);
  requireArray(run?.scenarios, `${path}.scenarios`, errors);

  const scenarios = Array.isArray(run?.scenarios) ? run.scenarios.map((scenario, scenarioIndex) => {
    return normalizeScenario(scenario, `${path}.scenarios[${scenarioIndex}]`, errors);
  }) : [];
  const passed = new Set(scenarios.filter((scenario) => scenario.status === "passed").map((scenario) => scenario.id));
  for (const scenarioId of requiredDeviceScenarios) {
    if (!passed.has(scenarioId)) errors.push(`${platform ?? path} missing scenario ${scenarioId}`);
  }

  return compact({
    platform,
    deviceModel: run?.deviceModel,
    osVersion: run?.osVersion,
    appBuild: run?.appBuild ?? input.appBuild,
    tester: run?.tester ?? input.tester,
    completedAt: run?.completedAt ?? input.completedAt,
    evidenceRefs: sanitizeRefs(run?.evidenceRefs, `${path}.evidenceRefs`, errors),
    scenarios,
  });
}

function normalizeScenario(scenario, path, errors) {
  const id = requireEnum(scenario?.id, requiredDeviceScenarios, `${path}.id`, errors);
  const status = requireEnum(scenario?.status, ["passed"], `${path}.status`, errors);
  requireString(scenario?.observedResult, `${path}.observedResult`, errors);
  requireArray(scenario?.evidenceRefs, `${path}.evidenceRefs`, errors);
  return compact({
    id,
    status,
    observedResult: scenario?.observedResult,
    evidenceRefs: sanitizeRefs(scenario?.evidenceRefs, `${path}.evidenceRefs`, errors),
  });
}

function sanitizeRefs(refs, path, errors) {
  if (!Array.isArray(refs)) return [];
  return refs.map((ref, index) => {
    requireString(ref, `${path}[${index}]`, errors);
    if (typeof ref === "string" && hasSecretLikeText(ref)) {
      errors.push(`${path}[${index}] must not contain secret-like values`);
    }
    return ref;
  });
}

function requireString(value, path, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
    return undefined;
  }
  if (isPlaceholder(value)) errors.push(`${path} contains placeholder text`);
  if (hasSecretLikeText(value)) errors.push(`${path} must not contain secret-like values`);
  return value;
}

function requireArray(value, path, errors) {
  if (!Array.isArray(value)) errors.push(`${path} must be an array`);
}

function requireEnum(value, allowed, path, errors) {
  requireString(value, path, errors);
  if (typeof value === "string" && !allowed.includes(value)) {
    errors.push(`${path} must be one of: ${allowed.join(", ")}`);
  }
  return typeof value === "string" ? value : undefined;
}

function readJson(path) {
  if (!existsSync(path)) fail(`Input file does not exist: ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Input file is not valid JSON: ${formatError(error)}`);
  }
}

function writeJson(path, value) {
  const resolved = resolve(path);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child != null));
}

function isPlaceholder(value) {
  return /\b(TODO|TBD|PLACEHOLDER|PENDING|EXAMPLE|SAMPLE|REPLACE_ME)\b/i.test(value);
}

function hasSecretLikeText(value) {
  return /\b(sk_live_|sk_test_|pk_live_|whsec_|AIza[0-9A-Za-z_-]{16,}|BROWSERSTACK_ACCESS_KEY=|access_key=)\b/.test(value);
}

function parseArgs(args) {
  const inputPath = valueAfter(args, "--input");
  const outputPath = valueAfter(args, "--output") ?? "docs/release/evidence/browserstack-real-device-evidence.json";
  if (!inputPath || args.includes("--help") || args.includes("-h")) usage(inputPath ? 0 : 1);
  return { inputPath, outputPath };
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`${flag} requires a value`);
  return value;
}

function usage(exitCode = 0) {
  console.log(`Usage:\n  npm run browserstack:real-device-evidence -- --input browserstack-evidence.json [--output docs/release/evidence/browserstack-real-device-evidence.json]\n\nThe input JSON must contain one android and one ios BrowserStack real-device run, with every required release scenario passed and linked to BrowserStack artifacts. The output is a manifest-ready { realDeviceRuns } fragment. It does not fake device evidence or call BrowserStack APIs.`);
  process.exit(exitCode);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
