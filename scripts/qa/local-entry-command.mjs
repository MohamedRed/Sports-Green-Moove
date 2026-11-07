import assert from 'node:assert/strict';

export function localEntryCommand(executable, entry) {
  assert(['darwin', 'linux'].includes(process.platform), 'Local emulator entries require a POSIX shell');
  const quote = (value) => {
    assert(typeof value === 'string' && value.length > 0 && !value.includes('\0'));
    return `'${value.replaceAll("'", "'\\''")}'`;
  };
  // Replace the CLI's shell so group signals reach the entry, not a waiting wrapper.
  return `exec ${quote(executable)} ${quote(entry)}`;
}
