import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {root} from './local-runtime.mjs';

const suites = ['security-rules', 'chat-inbox-rules', 'chat-source-access-rules', 'membership-rules',
  'trip-capacity-rules', 'team-ownership-rules', 'trip-cancellation-rules', 'trip-details-rules',
  'trip-change-rules', 'booking-request-rules', 'child-account-link-rules'];
execFileSync(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run',
  ...suites.map(name => `tests/${name}.test.ts`), '--no-file-parallelism', '--reporter=json',
  '--outputFile', process.env.SGM_LOCAL_FLOW_OUTPUT], {cwd: root, env: process.env, stdio: 'inherit'});
