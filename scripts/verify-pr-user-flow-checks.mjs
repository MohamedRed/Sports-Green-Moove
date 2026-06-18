#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { requiredUserFlowChecks } from "./release-evidence-requirements.mjs";

const options = parseArgs(process.argv.slice(2));
const source = loadCheckSource(options);
const report = buildReport(source);

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

if (!report.ok) {
  process.exit(1);
}

function buildReport(source) {
  const checks = Array.isArray(source.statusCheckRollup) ? source.statusCheckRollup : [];
  const results = requiredUserFlowChecks.map((required) => {
    const actual = checks.find((check) => {
      const nameMatches = check?.name === required.name;
      const workflowMatches = !check?.workflowName || check.workflowName === required.workflowName;
      return nameMatches && workflowMatches;
    });
    const conclusion = normalizeConclusion(actual?.conclusion);
    const status = normalizeStatus(actual?.status);
    const completed = status === "COMPLETED";
    const acceptable = completed && required.acceptableConclusions.includes(conclusion);
    return {
      workflowName: required.workflowName,
      name: required.name,
      requiredConclusions: required.acceptableConclusions,
      status,
      conclusion,
      detailsUrl: actual?.detailsUrl ?? actual?.url ?? null,
      ok: Boolean(actual) && acceptable,
      issue: issueFor(actual, completed, conclusion, required.acceptableConclusions),
    };
  });

  return {
    ok: results.every((result) => result.ok),
    pullRequest: source.url ?? null,
    headRefOid: source.headRefOid ?? latestCommitOid(source.commits) ?? null,
    checkedAt: new Date().toISOString(),
    results,
    missing: results.filter((result) => result.issue === "missing").map(checkLabel),
    incomplete: results.filter((result) => result.issue === "incomplete").map(checkLabel),
    failed: results.filter((result) => result.issue === "bad_conclusion").map(checkLabel),
  };
}

function issueFor(actual, completed, conclusion, acceptableConclusions) {
  if (!actual) return "missing";
  if (!completed) return "incomplete";
  if (!acceptableConclusions.includes(conclusion)) return "bad_conclusion";
  return null;
}

function loadCheckSource({ input, repo, pr }) {
  if (input) {
    if (!existsSync(input)) {
      fail(`Check rollup input does not exist: ${input}`);
    }
    return JSON.parse(readFileSync(input, "utf8"));
  }

  const raw = execFileSync(
    "gh",
    ["pr", "view", pr, "--repo", repo, "--json", "commits,statusCheckRollup,url"],
    { encoding: "utf8" },
  );
  return JSON.parse(raw);
}

function latestCommitOid(commits) {
  if (!Array.isArray(commits) || commits.length === 0) return undefined;
  return commits.at(-1)?.oid;
}

function printReport(report) {
  console.log(report.ok ? "PR user-flow checks passed" : "PR user-flow checks are not ready");
  if (report.pullRequest) console.log(`Pull request: ${report.pullRequest}`);
  if (report.headRefOid) console.log(`Head commit: ${report.headRefOid}`);
  printList("Missing checks", report.missing);
  printList("Incomplete checks", report.incomplete);
  printList("Failed checks", report.failed);
}

function printList(label, items) {
  console.log(`${label}: ${items.length === 0 ? "none" : items.join(", ")}`);
}

function checkLabel(check) {
  return `${check.workflowName} / ${check.name}`;
}

function normalizeConclusion(value) {
  return typeof value === "string" ? value.toUpperCase() : "";
}

function normalizeStatus(value) {
  return typeof value === "string" ? value.toUpperCase() : "";
}

function parseArgs(args) {
  return {
    input: valueAfter(args, "--input"),
    repo: valueAfter(args, "--repo") ?? "MohamedRed/Sports-Green-Moove",
    pr: valueAfter(args, "--pr") ?? "1",
    json: args.includes("--json"),
  };
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`${flag} requires a value`);
  }
  return value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
