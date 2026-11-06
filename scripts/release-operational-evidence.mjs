import {existsSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {requiredOperationalDeviceEvidence, requiredOperationalEvidence} from './release-evidence-requirements.mjs';

const platforms = ['ios', 'android'];
const fields = ['platform', 'status', 'deviceKind', 'deviceModel', 'osVersion', 'appBuild', 'tester', 'completedAt', 'observedResult', 'evidenceRefs'];
const textFields = ['deviceModel', 'osVersion', 'appBuild', 'tester', 'completedAt', 'observedResult'];
const placeholder = value => /\b(TODO|TBD|PLACEHOLDER|PENDING|EXAMPLE|SAMPLE|REPLACE_ME)\b/i.test(value);

export function operationalEvidenceGaps(items, {manifestDir, allowPlaceholders = false} = {}) {
  const entries = Array.isArray(items) ? items : [], issues = [], passed = [];
  const byPlatform = Object.fromEntries(platforms.map(platform => [platform, {passed: [], missing: []}]));
  for (const id of requiredOperationalEvidence) {
    const matches = entries.filter(item => item?.id === id), item = matches[0];
    const start = issues.length, problem = message => issues.push(`${id}: ${message}`);
    if (matches.length !== 1) problem('must have exactly one operational evidence item');
    if (!requiredOperationalDeviceEvidence.includes(id)) {
      if (matches.length === 1 && item?.status === 'accepted') passed.push(id);
      continue;
    }
    const rows = Array.isArray(item?.platformRuns) ? item.platformRuns : [];
    if (!Array.isArray(item?.platformRuns)) problem('platformRuns must be an array for ios and android');
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || !platforms.includes(row.platform)) {
        problem('platformRuns contains an unknown or malformed platform'); continue;
      }
      if (Object.keys(row).some(field => !fields.includes(field))) problem(`${row.platform} evidence has unsupported fields`);
    }
    const sharedProblem = issues.length !== start;
    for (const platform of platforms) {
      const before = issues.length, runs = rows.filter(row => row?.platform === platform), run = runs[0];
      if (runs.length !== 1) problem(`${platform} must have exactly one platform run`);
      else if (!['passed', 'pending', 'failed'].includes(run.status)) problem(`${platform} status is invalid`);
      else if (run.status !== 'passed') {
        if (!allowPlaceholders) problem(`${platform} status must be passed`);
      } else {
        if (run.deviceKind !== 'physical') problem(`${platform} deviceKind must be physical`);
        for (const field of textFields) {
          const value = run[field];
          if (typeof value !== 'string' || !value.trim() || (!allowPlaceholders && placeholder(value)))
            problem(`${platform}.${field} must be recorded without placeholders`);
        }
        if (typeof run.completedAt === 'string' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(run.completedAt) || !Number.isFinite(Date.parse(run.completedAt))))
          problem(`${platform}.completedAt must be a valid timestamp`);
        if (!Array.isArray(run.evidenceRefs) || run.evidenceRefs.length === 0) problem(`${platform} requires its own artifact references`);
        else for (const ref of run.evidenceRefs) {
          if (typeof ref !== 'string' || !ref.trim() || (!allowPlaceholders && placeholder(ref))) {
            problem(`${platform} artifact reference is invalid`); continue;
          }
          if (!allowPlaceholders && !/^https:\/\/[^\s]+$/i.test(ref) &&
              (!manifestDir || !existsSync(isAbsolute(ref) ? ref : resolve(manifestDir, ref))))
            problem(`${platform} artifact reference does not exist`);
        }
      }
      const complete = matches.length === 1 && item.status === 'accepted' && runs.length === 1 &&
        run.status === 'passed' && !sharedProblem && issues.length === before;
      byPlatform[platform][complete ? 'passed' : 'missing'].push(id);
    }
    if (matches.length === 1 && item.status === 'accepted' && issues.length === start &&
        platforms.every(platform => byPlatform[platform].passed.includes(id))) passed.push(id);
  }
  for (const platform of platforms) byPlatform[platform].ok = byPlatform[platform].missing.length === 0;
  const missing = requiredOperationalEvidence.filter(id => !passed.includes(id));
  return {ok: missing.length === 0 && issues.length === 0, required: requiredOperationalEvidence, passed, missing, byPlatform, issues};
}
