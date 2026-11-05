import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const baseline = '61c3f2048d478707494e4ad90f1819f0860842ef';
const source = execFileSync('git', ['show', baseline + ':ios/Sources/SportsGreenMooveApp/MessagesScreen.swift'], {encoding:'utf8'});
function method(name) {
  const start = source.indexOf('    private func ' + name + '(');
  assert(start >= 0);
  const brace = source.indexOf('{', start); let depth = 1, end = brace + 1;
  for (; depth && end < source.length; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  assert.equal(depth, 0);
  return source.slice(start, end).replace('private func', 'func');
}
const directory = mkdtempSync(join(tmpdir(), 'sgm-message-regression-'));
try {
  const harness = `import Foundation
struct InboxSummary: Sendable { var marker = "empty" }
struct InboxReviewPrompt { let id = "review"; let rideSessionId = "ride"; let ratedUserId = "driver" }
@MainActor final class Reviews { func replace(_ inbox: InboxSummary) {}; func submitted(_ id: String) {} }
actor Gateway {
    var reply: CheckedContinuation<Void, Never>?
    var waiting: Bool { reply != nil }
    func wait() async { await withCheckedContinuation { reply = $0 } }
    func release() { reply?.resume(); reply = nil }
    func getInbox() async throws -> InboxSummary { await wait(); return .init(marker: "old-private-message") }
    func submitRating(rideSessionId: String, ratedUserId: String, score: Int, comment: String?) async throws -> String {
        await wait(); return "old-rating"
    }
}
@MainActor final class App { let firebase = Gateway(); var accountGeneration = 0 }
@MainActor final class Screen {
    let appState = App(), reviews = Reviews()
    var inbox = InboxSummary(), loading = false, submittingReviewId: String?, error: String?, notice: String?
${method('loadInbox')}
${method('submitReview')}
}
@main struct Main {
    @MainActor static func main() async {
        let read = Screen(), write = Screen()
        let first = Task { await read.loadInbox() }
        while !(await read.appState.firebase.waiting) { await Task.yield() }
        read.appState.accountGeneration += 1
        await read.appState.firebase.release(); await first.value
        let second = Task { await write.submitReview(.init(), score: 5) }
        while !(await write.appState.firebase.waiting) { await Task.yield() }
        write.appState.accountGeneration += 1
        await write.appState.firebase.release(); await second.value
        precondition(read.inbox.marker == "old-private-message" && write.notice != nil)
        print("Baseline actual screen methods: staleInboxRestored=true staleRatingNoticeRestored=true")
        print("Controlled callback reproduction only; no SDK, account, provider or phone request.")
    }
}`;
  const file = join(directory, 'Regression.swift'), executable = join(directory, 'regression');
  writeFileSync(file, harness, {flag:'wx'});
  execFileSync('swiftc', ['-swift-version','6','-parse-as-library',file,'-o',executable], {stdio:'inherit'});
  process.stdout.write(execFileSync(executable, {encoding:'utf8'}));
  console.log(JSON.stringify({baseline, sourceSha256:createHash('sha256').update(source).digest('hex'),
    projection:'exact-two-screen-methods-with-controlled-model-and-gateway-types', sdkBuildAccepted:false, releaseAccepted:false}));
} finally { rmSync(directory, {recursive:true, force:true}); }
