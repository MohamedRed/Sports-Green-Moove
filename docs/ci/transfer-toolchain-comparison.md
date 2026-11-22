# Explicit Transfer Toolchain Comparison

The account-free diagnostic at `84cb6b2` (run `41353565294`, artifact
`13102725679`, SHA-256 `b14c729b6079fd1338561d03b1ceaa2e3d7f64327e533a67ef7bbbec8c7eb511`)
passes six exact-byte transfers and fails the seventh. Host emulator and connection
server processes survive, but their peer socket disappears. Guest identity is
available before the trial, not after it. Cleanup then removes the owned generated
files. This does not identify a crash, a guest restart, who closed the connection,
or a particular version as its cause. No product app or accounts were involved.
The separate full native run at `93d9138` (run `41351599563`, job `124982775782`)
also fails its primary emergency-contact evidence copy after 248 ordinary passes
and 55 intentional skips. Its focused lanes passed; the whole gate did not.

The diagnostic workflow now has an explicit `platform_tools` manual choice:
`sdk-default` (unchanged ordinary selection) or `36.0.2` (a comparison only).
The alternate version comes from the official Google Linux archive, pinned to
SHA-256 `3afdea91441815ab41254193df0343d92c1b1c0d0237165c3a345c8af8891c31`.
The archive was downloaded and digest/revision checked on the developer computer;
the Linux binary was not installed or executed there.

Selection is permitted only on a disposable GitHub-hosted Linux runner, after SDK
installation and before device boot. It refuses an existing connection server or
virtual device, verifies the archive digest and staged revision, and records the
exact binary hash. It does not kill an unknown process or retry a failed selection
with another version. The probe separately requires a matching selection receipt,
because the upstream action may continue launching after a pre-launch error.
The receipt is included in the environment artifact; no user data or credentials
are collected. Failed original copies and the 32-transfer/no-retry/integrity/cleanup
requirements remain unchanged. No application test gate uses this selection.

The pre-launch phase is documented by the action's
[implementation](https://github.com/ReactiveCircus/android-emulator-runner/blob/main/src/main.ts),
which installs SDK tools before invoking it. The
[SDK installer](https://github.com/ReactiveCircus/android-emulator-runner/blob/main/src/sdk-installer.ts)
otherwise installs current platform tools, so merely changing an earlier PATH
would not establish a controlled server/binary comparison.

After pushing this source, dispatch only the diagnostic workflow with
`platform_tools=36.0.2` and retain the exact run, requested/installed versions,
binary/archive hashes and original first failure or complete sequence. Compare it
with the current-version control on the same source. One successful comparison
does not establish root cause, repair an earlier failure, pass the full native
workflow, or prove real-phone user flows. No Terraform or production change is
made: this modifies only tools in the disposable diagnostic runner.
