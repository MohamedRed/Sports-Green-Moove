# Compatible Parser Security Patches

Baseline: `385a6a4418848b46f4ea522c2903ee22be8b1ee6`. Retained audit snapshots
were collected on 5 November; the fresh service replay was completed on 6 November.

The installed server protocol parser and payment query encoder reproduce six
failing cases in the corrected twelve-case regression baseline. The identical
test sources pass all twelve after a clean install. These child probes deny
network access and bound memory, output and execution time. Ordinary RPC data
round trips and both payment parameter formats remain checked.

Only five lock entries change: Express 4.22.2 to 4.22.3, protobufjs 7.6.3 to
7.6.6, qs 6.15.2 to 6.16.2, and removal of two superseded transitive entries.
Existing consumer ranges, direct manifests, application source and Node/Firebase
major versions stay unchanged. No overrides, downgrade or fallback is added.

The corrected baseline is distinct from the initial harness error, which tried
serialization on a message descriptor rather than the real RPC service methods.
The rejected initial package plan included unrelated changes and was not accepted.
Both originals are retained without counting them as vulnerability reproductions.

Backend units pass 623 cases and all three workspaces build. The later isolated
service replay passes all 24 groups with verified teardown; the previous service
attempt was interrupted after a function-load failure and is not accepted.
Its cause, including any relationship to the host interruption, is unconfirmed.
The fresh access-rule suite passes 219 cases, simulated payment/webhook handling
passes 78, and notification-read handling passes 20. These do not test payment
provider delivery, live funds or closed-app push. Independent local endpoint
closure and absence of the disposable service directory are retained.

The whole-workspace audit drops from 30 findings to 28; functions production
dependencies drop from 10 moderate findings to 8. Five high findings remain in
the client SDK chain. No production exploit, deployment, real payment, physical
flow, native instability fix or complete release is established.

Primary advisories:
- [Protocol option parser](https://github.com/protobufjs/protobuf.js/security/advisories/GHSA-j3f2-48v5-ccww)
- [Query buffer marker](https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g)
- [Query comma conversion](https://github.com/ljharb/qs/security/advisories/GHSA-6pq8-jhm2-2vcw)

The separate iPhone recheck at the baseline source predates this lock change.
Its ten passes and one failed first-search assertion cannot be attributed to it.
