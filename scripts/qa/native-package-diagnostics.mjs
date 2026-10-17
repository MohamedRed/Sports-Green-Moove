import assert from 'node:assert/strict';

const packageFields = new Set(['appPackageName', 'installerPackageName',
  'installInitiatingPackageName', 'mOriginalInstallerPackageName']);
const numericFields = new Set(['createdMillis', 'updatedMillis', 'committedMillis',
  'mFinalStatus', 'mSessionErrorCode', 'mParentSessionId']);
const booleanFields = new Set(['mCommitted', 'mSealed', 'mDestroyed',
  'mSessionApplied', 'mSessionFailed', 'mSessionReady']);

// Installer dumps also contain URIs and free-form error messages: retain only typed state.
export function installationState(output) {
  const sections = [];
  let section, session;
  const lines = [];
  for (const line of output.split('\n')) {
    const first = line.trim().split(/\s+/)[0];
    const structural = /install sessions:|^(?:(?:Active|Finalized|Orphaned) (?:Child )?)?Session \d+:$/.test(line.trim());
    if (lines.length && first && !first.includes('=') && !structural && /\w+=\S*$/.test(lines.at(-1)))
      lines[lines.length - 1] += line.trimStart();
    else lines.push(line);
  }
  for (const line of lines) {
    const header = line.trim().match(/^(Active|Historical|Finalized|Orphaned|Legacy) install sessions:$/);
    if (header) {
      section = { kind: header[1].toLowerCase(), sessions: [] };
      sections.push(section); session = undefined;
      continue;
    }
    const identity = line.trim().match(/^(?:(?:Active|Finalized|Orphaned) (?:Child )?)?Session (\d+):$/);
    if (identity && section) {
      session = { id: Number(identity[1]) }; section.sessions.push(session);
      continue;
    }
    if (!session) continue;
    for (const [, key, value] of line.matchAll(/(?:^|\s)(\w+)=([^\s]+)/g)) {
      if (packageFields.has(key) && /^(?:null|[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+)$/.test(value)) session[key] = value;
      if (numericFields.has(key) && /^-?\d{1,16}$/.test(value)) session[key] = Number(value);
      if (booleanFields.has(key) && /^(true|false)$/.test(value)) session[key] = value === 'true';
    }
  }
  assert(sections.some(({ kind }) => kind === 'active'), 'Installer state dump did not expose its active-session section');
  return JSON.stringify({ scope: 'typed-install-session-diagnostic-not-cause-or-flow-verification', sections }, null, 2) + '\n';
}

export const packageOperationQueries = [
  ['frozen-packages', ['shell', 'dumpsys', 'package', 'frozen']],
  ['install-sessions', ['shell', 'dumpsys', 'package', 'installs'], installationState],
  ['package-operations', ['logcat', '-d', '-b', 'main', '-b', 'system', '-t', '4000', '-v', 'threadtime',
    'PackageManager:I', 'PackageInstaller:I', 'PackageInstallerSession:I', 'installd:I', '*:S']],
];
