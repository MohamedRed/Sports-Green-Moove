import {readFileSync} from 'node:fs';

const fields = (text, suffix = '') => Object.fromEntries(text.trim().split('\n').flatMap(line => {
  const match = line.match(new RegExp('^([A-Za-z_]+):?\\s+(\\d+)' + suffix + '$'));
  return match ? [[match[1], Number(match[2])]] : [];
}));
export function sampleProofResources({platform = process.platform, read = path => readFileSync(path, 'utf8'),
  now = () => new Date().toISOString()} = {}) {
  const sample = {scope: 'allowlisted-host-resource-observation-not-cause-or-flow-proof', observedAt: now(),
    linux: platform === 'linux', resources: {}, unavailable: []};
  if (!sample.linux) return sample;
  const collect = (key, path, parse) => {
    try {sample.resources[key] = parse(read(path));} catch {sample.unavailable.push(key);}
  };
  collect('hostMemoryBytes', '/proc/meminfo', text => {
    const values = fields(text, '\\s+kB');
    return Object.fromEntries(['MemTotal', 'MemAvailable', 'SwapTotal', 'SwapFree']
      .filter(key => key in values).map(key => [key, values[key] * 1024]));
  });
  for (const key of ['current', 'peak', 'max']) collect('cgroupMemory' + key[0].toUpperCase() + key.slice(1),
    '/sys/fs/cgroup/memory.' + key, text => {
      const value = text.trim();
      if (value === 'max') return 'max';
      if (!/^\d+$/.test(value)) throw new Error('Unrecognised counter');
      return Number(value);
    });
  collect('cgroupMemoryEvents', '/sys/fs/cgroup/memory.events', text => {
    const values = fields(text);
    return Object.fromEntries(['low', 'high', 'max', 'oom', 'oom_kill', 'oom_group_kill']
      .filter(key => key in values).map(key => [key, values[key]]));
  });
  return sample;
}
