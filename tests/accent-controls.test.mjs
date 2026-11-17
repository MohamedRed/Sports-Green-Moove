import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {accentControlsFolder, validateAccentControlEvidence} from '../scripts/qa/accent-controls-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), read = file => readFileSync(resolve(root, file), 'utf8');
test('eleven original contrast failures become twenty passing measurements and eight unchanged phone checkpoints', () => {
  const result = validateAccentControlEvidence(root);
  assert.deepEqual({...result, minimumTextContrast: 0}, {beforeCases: 18, beforeFailures: 11, afterCases: 20,
    afterFailures: 0, phoneCheckpoints: 8, reviewedCaptures: 7, publicCaptures: 5, minimumTextContrast: 0,
    allFlowRecordsUnchanged: true, fullAppAccessibilityAccepted: false, releaseAccepted: false});
  assert(result.minimumTextContrast >= 4.5);
});

for (const key of ['withdrawalInvoked', 'realPaymentExercised', 'productionWrites', 'iosUiExecuted',
  'screenReaderVerified', 'fullAppAccessibilityAccepted', 'gradientContrastAccepted', 'warningErrorTextAccepted',
  'releaseAccepted', 'nativeScreenshotExports', 'preparationFailuresAcceptedAsProductFailures'])
  test('rehashed physical evidence cannot invent ' + key, () => {
    const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-accent-scope-'));
    try {
      const evidence = resolve(temporary, 'docs/release/evidence'); mkdirSync(evidence, {recursive: true});
      cpSync(resolve(root, accentControlsFolder), resolve(temporary, accentControlsFolder), {recursive: true});
      symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(evidence, 'source-archive'));
      const folder = resolve(temporary, accentControlsFolder), review = JSON.parse(readFileSync(resolve(folder, 'review.json')));
      const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json'))); review[key] = true;
      const bytes = JSON.stringify(review, null, 2) + '\n';
      writeFileSync(resolve(folder, 'review.json'), bytes);
      hashes['review.json'] = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
      assert.throws(() => validateAccentControlEvidence(temporary), key);
    } finally {rmSync(temporary, {recursive: true, force: true});}
  });

test('flat controls use dedicated content roles while fixed brand tokens and hero white stay unchanged', () => {
  const colors = read('android/app/src/main/java/be/sportgreenmoove/app/design/SgmColors.kt');
  for (const required of ['val TextOnGreen = Color.White', 'val TextOnAccent = Color(0xFF0C1B0E)',
    'textAccent    = Color(0xFF176F37)', 'textAccent    = SgmColor.Green', '0xFF3EBD6C', '0xFFF97316']) assert(colors.includes(required));
  const components = read('android/app/src/main/java/be/sportgreenmoove/app/ui/V2Components.kt');
  assert(!components.includes('SgmColor.TextOnGreen'));
  assert(components.includes('V2ButtonVariant.Primary, V2ButtonVariant.Orange -> SgmColor.TextOnAccent'));
  assert(components.includes('V2ButtonVariant.Ghost -> Sgm.colors.textAccent'));
  assert(!components.includes('color: Color = SgmColor.Green'));
  for (const file of ['MessagesNavigation.kt', 'TripsScreen.kt', 'AppBottomBar.kt', 'ConversationMessageUi.kt', 'PublishControls.kt'])
    assert(read('android/app/src/main/java/be/sportgreenmoove/app/ui/' + file).includes('SgmColor.TextOnAccent'));
  const theme = read('android/app/src/main/java/be/sportgreenmoove/app/design/SgmTheme.kt');
  assert.equal(theme.split('primary = sgmColors.textAccent').length - 1, 2);
  assert(theme.includes('onPrimary = SgmColor.TextOnAccent')); assert(theme.includes('onPrimary = SgmColor.TextOnGreen'));
  const header = read('android/app/src/main/java/be/sportgreenmoove/app/ui/HomeHeaderHero.kt');
  assert(header.includes('SgmType.DisplayLG.copy(color = SgmColor.TextOnGreen'));
  const unit = read('android/app/src/test/java/be/sportgreenmoove/app/design/SgmAccentContrastTest.kt');
  assert(unit.includes('foregroundArgb: Int')); assert(unit.includes('compositeOver(background)'));
  assert(unit.includes('ratio >= minimum')); assert(!unit.includes('round('));
});

test('the manual observer changes no business records and always closes both independent clients', () => {
  const controller = read('scripts/qa/manual-accent-appearance-phone.mjs');
  assert.equal(controller.split("call('initializeUserProfile'").length - 1, 1);
  for (const method of ['requestBooking', 'issueRewardPayout', 'writeLocationBatch', 'sendChatMessage']) assert(!controller.includes(method));
  for (const required of ['verifySessionRestorationRecords(baseline, state)', 'withLocalAdminCleanup',
    'await db.terminate()', 'await deleteApp(app)', "delete process.env.SGM_QA_PASSWORD", "'signed-out'"])
    assert(controller.includes(required), required);
});

test('both native and web gates execute this evidence contract without replacing old workloads', () => {
  for (const file of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = read('.github/workflows/' + file);
    assert.equal(workflow.split('"tests/accent-controls.test.mjs"').length - 1, 2);
    assert(workflow.includes('run: node --test tests/accent-controls.test.mjs'));
    assert(workflow.includes('run: node --test tests/neutral-text-contrast.test.mjs'));
  }
});
