import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export function validateProgressEntries(root, content, flowIds) {
  const evidenceRoot = resolve(root, 'docs/release/evidence') + sep;
  for (const update of content.updates) {
    assert.match(update.date, /^\d{4}-\d{2}-\d{2}$/);
    assert(flowIds.has(update.flow)); assert(update.date <= content.updatedAt);
    if (update.coversFlows) assert(Array.isArray(update.coversFlows) && update.coversFlows.every(id => flowIds.has(id)));
    if (update.source) {
      const path = resolve(root, update.source);
      assert(path.startsWith(evidenceRoot)); assert(existsSync(path));
    }
  }
  for (const blocker of content.blockers) assert(existsSync(resolve(root, blocker.source)));
}
