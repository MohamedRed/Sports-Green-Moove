# Long Ledger History, 24 October 2026

## Reproduction And Fix

The old Android and iOS gateways both capped owned ledger reads at 100. An actual
isolated query replay with 257 owned entries returns +10,000 cents from the cap
but -22,000 cents from the complete ledger. Impact is similarly 125 kg / 100
rides instead of 321.25 kg / 257 rides. Original native source bytes are archived.
The earliest query receipt is retained; its first script revision was not frozen.
The final eight-group replay reproduces those queries again with retained source.

The apps now use authenticated server summaries. Each complete read shares one
read-only snapshot across 200-row pages; only eight history entries and six
occupied Belgian months are returned. Bad records fail closed. No transaction,
provider request, payout, account privilege or production data is changed.

## Executed Scope

- Eight authenticated isolated service groups pass: query reproduction, auth and
  request boundaries, complete posted balance, mixed-timestamp history, complete
  impact/months, foreign/empty accounts, malformed records and unchanged records.
- Twenty new backend units pass; the full backend suite passes 466 cases.
- Four Android wire units pass; app and instrumentation APKs compile.
- The full Android unit task and all 2,048 root checks pass. The first root pass
  exposed two obsolete static expectations: direct client ledger scans and the
  artifact inventory. Updated those contracts and kept every upload after tests
  so an artifact-service failure cannot suppress later checks.
- Swift wire checks and the existing native-policy check executable pass locally.
  This does not compile the Firebase-backed iOS adapter or verify iPhone UI.
- One connected Android case passes with the actual isolated SDK/backend. It
  reads the full values, displays impact/rewards, recreates the activity, switches
  to another account and returns to the original balance. It signs out at end.
- An independent post-case snapshot verifies all protected records and claims,
  except the documented profile-initialization timestamps, unchanged.
- Primary capture collection, package removal, Admin/Firestore termination,
  disposable backend deletion and free endpoints are verified. The named device
  is then stopped/deleted; host exit, device disappearance and ports are checked.

The final case includes the signed-cent UI formatter correction (widen before
absolute value). Four reviewed originals are published. The initial balance
capture is retained but excluded as a duplicate; earlier 15 October evidence
keeps its original date. No screen contents are edited.

These are local trials, not physical-phone, process-restart, live tracking,
real-money, iOS-provider, production-deployment or release acceptance. The posted
balance is not spendable credit. The full PR checks for the preceding 89db53e6
head passed; the new head still needs its own complete replay. Overall tests
remain unfinished, including the release manifest's physical and safety gaps.
