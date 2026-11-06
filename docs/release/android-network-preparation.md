# Android Network Preparation Diagnostics

The [retained 04 prerequisite failure](evidence/native-copy-376addb-2026-11-06/README.md#separate-later-prerequisite)
never installs the app: Wi-Fi remains unvalidated during the fixed 180-second
observation, while cellular later validates. Android history records resolution
failures, not their underlying cause. This differs from the preceding primary
evidence-copy disconnect after a passing time-input device case.

On Linux/macOS, the emulator reads host resolver addresses from `/etc/resolv.conf`
and aliases up to four of them. This makes the host configuration a relevant
diagnostic input, not an established cause of this failure.
[Android documentation](https://developer.android.com/studio/run/emulator-networking-dns).
The systemd stub and upstream resolver files are distinct compatibility modes.
[systemd documentation](https://www.freedesktop.org/software/systemd/man/258/systemd-resolved.service.html).

## Passive Collection

`observe-host-dns.mjs` runs before the existing full matrix and before only the
existing focused `chat-network-recovery` launch. It starts no additional device,
DNS query, external network connection or provider request. It changes no resolver, radio, service,
logging policy, emulator option, assertion, case count or deadline. There is no
retry, replacement resolver, fallback or new privileged operation.

The existing artifact globs retain `host-dns-before-launch.json`. It records only
resolver-file layout, address-family/category counts and first-four categories,
presence of search/domain/options directives, and an allowlisted service state.
Actual addresses, domains, comments, options, paths, raw service output and child
environment are not retained. The service query receives only a fixed PATH and
locale and is bounded to two seconds. File reads are capped at 64 KiB, root-owned,
non-writable by other users, nonblocking and no-follow; changes during reading or
descriptor-close errors invalidate the observation.

For recognized stub layouts, upstream categories are a separate read-only
observation. They never replace the primary configuration. Missing, malformed,
untrusted or unsupported inputs remain explicitly unobserved; they neither grant
network readiness nor become a different resolver. These observations are not
atomic and do not prove the emulator's actual DNS binding or working resolution.

## Acceptance Boundary

The existing 180-second validated-default-Wi-Fi predicate and the original full
matrix, eleven focused cases, 50-minute full gate and 25-minute focused gate are
unchanged. Tests remove only the exact added passive steps before comparing every
original workflow job with its retained source. Missing observations cannot be
reported as a diagnosis, network repair, user-flow pass or release acceptance.

Inspect the actual paired CI artifacts before choosing any configuration change.
The current correction is an observability addition, not a DNS repair. Keep
technical diagnostics out of the public partner-site copy; update user-flow
results only when actual flow evidence changes.

```sh
node --test tests/host-dns-configuration.test.mjs tests/host-dns-system-inputs.test.mjs tests/host-dns-filesystem.test.mjs tests/host-dns-observation.test.mjs tests/host-dns-workflow.test.mjs
```
