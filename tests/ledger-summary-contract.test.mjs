import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(path, 'utf8');

test('native ledger totals use authenticated server summaries without a capped client ledger scan', () => {
  const android = read('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidLedgerGateway.kt');
  const ios = read('ios/Sources/SportsGreenMooveApp/FirebaseImpactRewards.swift');
  for (const source of [android, ios]) {
    assert.doesNotMatch(source, /\.limit\(|collection\("(?:co2Ledger|rewardLedger)"\)/);
    assert(source.includes('"getImpactSummary"') && source.includes('"getRewardSummary"'));
    assert(source.includes('currentUser?.uid'));
  }
  assert.equal((android.match(/auth.currentUser\?\.uid != uid/g) ?? []).length, 2);
  assert.equal((ios.match(/Auth.auth\(\).currentUser\?\.uid == uid/g) ?? []).length, 2);
});
test('all pages share one read-only snapshot and only history is trimmed', () => {
  const service = read('functions/src/services/ledgerSummaries.ts'), domain = read('functions/src/domain/ledgerSummaries.ts');
  assert.match(service, /where\("userId", "==", uid\)/);
  assert.match(service, /readOnly: true/); assert.match(service, /query\.startAfter\(cursor\)/);
  assert.match(service, /if \(page.size < 200\) break/);
  assert.doesNotMatch(service, /\.(?:set|update|create|delete)\(/);
  assert.match(domain, /this.balance \+= BigInt\(amountCents\)/);
  assert.match(domain, /this.entries = this.entries.slice\(0, 8\)/);
  assert.match(domain, /row.currency !== "eur"/); assert.match(domain, /Number.isSafeInteger/);
});
test('summary endpoints cannot accept a client-selected owner, cursor or limit', () => {
  const callable = read('functions/src/callables/ledgerSummaries.ts');
  assert.equal((callable.match(/requireAuth\(request.auth\?\.uid\)/g) ?? []).length, 2);
  assert.equal((callable.match(/parseCallableData\(ledgerSummaryRequest, request.data\)/g) ?? []).length, 2);
  assert.match(read('functions/src/domain/ledgerSummaries.ts'), /z.object\(\{\}\).strict\(\)/);
});
test('web smoke selects and runs the long-history authenticated replay', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  for (const path of ['tests/ledger-summary*.test.mjs', 'scripts/qa/*ledger-history*.mjs'])
    assert.equal(workflow.split('"' + path + '"').length - 1, 2);
  assert(workflow.includes('node scripts/qa/run-ledger-history-services.mjs'));
  assert(workflow.includes('node --test tests/ledger-summary-contract.test.mjs tests/ledger-summary-evidence.test.mjs'));
});
