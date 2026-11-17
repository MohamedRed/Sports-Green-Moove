import test from 'node:test';
import assert from 'node:assert/strict';
import {assertChatNetworkReceipt} from '../scripts/qa/chat-network-evidence.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateChatDraftReplayPhone, validateChatDraftReplayReview, chatDraftReplayPhoneFolder}
  from '../scripts/qa/chat-draft-replay-phone-evidence.mjs';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';

export function registerDraftContractTests({receipt, native, read}) {
  test('the Android force-stop replay cannot become pending-send, peer-phone or release proof', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    validateChatDraftReplayPhone(root);
    const review = JSON.parse(read(chatDraftReplayPhoneFolder + 'review.json'));
    for (const key of ['providerKillCompletionAccepted', 'independentProcessIdsObserved', 'actualMessageSendAccepted',
      'accountSwitchOnPhoneAccepted', 'pendingSendRestartAccepted', 'peerPhoneAccepted', 'iOSAccepted', 'productionWrites', 'releaseAccepted']) {
      assert.throws(() => validateChatDraftReplayReview({...review, [key]: true}));
    }
    for (const key of ['androidForceStopConfirmationObserved', 'androidForceStopDisabledAfter', 'sameVisibleDraftRestored']) {
      assert.throws(() => validateChatDraftReplayReview({...review, [key]: false}));
    }
    const folder = 'docs/release/evidence/chat-draft-ci-contract-2026-10-31/';
    assertEvidenceBundleChecksums(resolve(fileURLToPath(new URL('../' + folder, import.meta.url))));
    const source = JSON.parse(read(folder + 'source.json'));
    assert.equal(source.chatNetwork.updatedInstrumentationExecuted, false);
    assert.equal(source.sessionRestoration.rootCauseEstablished, false);
    assert.equal(source.sessionRestoration.repairAccepted, false);
    assert.equal(source.fullNativeGateAccepted, false);
    assert.match(read(folder + 'chat-network-instrumentation.txt'), /LocalChatNetworkFlowTest.kt:162/);
    assert.match(read(folder + 'session-restoration-instrumentation.txt'), /Condition still not satisfied after 60000 ms/);
  });
  test('durable-draft replays require owner restoration while preserving historical evidence scope', () => {
    const ui = {...receipt(), privateDraftPersistenceVersion: 1, parentDraftRestored: true};
    assertChatNetworkReceipt(ui);
    for (const value of [false, undefined]) {
      assert.throws(() => assertChatNetworkReceipt({...ui, parentDraftRestored: value}));
    }
    assert.throws(() => assertChatNetworkReceipt({...ui, privateDraftPersistenceVersion: 2}));
    const replay = native('LocalChatNetworkFlowTest');
    assert.match(replay, /login\("driver"\)[\s\S]*assertDraft\(""\)/);
    assert.match(replay, /openConversation\(reply\)[\s\S]*assertDraft\(privateDraft\)/);
    assert.match(replay, /put\("privateDraftPersistenceVersion", 1\)/);
    assert.match(replay, /put\("parentDraftRestored", true\)/);
    assert.match(read('scripts/qa/local-chat-network-ui.mjs'), /assert.equal\(ui.privateDraftPersistenceVersion, 1/);
    for (const workflow of ['native-ci', 'web-integration-smoke']) {
      assert.equal(read('.github/workflows/' + workflow + '.yml').split('"tests/chat-network-draft-cases.mjs"').length - 1, 2);
    }
  });
}
