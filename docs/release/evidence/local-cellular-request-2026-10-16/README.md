# Explicit Cellular Request Replay

Native [38886780376](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/38886780376)
passed all enabled jobs at `5b76afc46f015c9f8d0b1a684003be2ebd84f6b5`.
The unmodified result records run `6b443eedcf95da94692b59b734524311`, tested
at 2026-10-16T10:34:28.185Z: 17 isolated cases and 19 coverage groups passed.
The four search cases still use their explicit component fake gateways.
The final result was written only after independent persisted checks and cleanup.

## Verified In This Run

- The read-only modem reader accepts the installed console format. Before/after
  receipts are bound to this run and both report home voice/data registration.
- The request is registered before preparation, receives an availability
  callback, loses the network at the cutoff, receives another callback after
  restoration, and is released before subsequent cross-account exchanges.
- Prepared Wi-Fi and cellular networks are present. Wi-Fi is disabled first and
  the active cellular route still reaches the isolated backend. Both radios are
  then disabled: no active/internet network exists and the backend is unreachable.
- The app shows an unconfirmed send, retains its draft, explicitly retries after
  restoration, and the driver replies. Independent checks confirm exactly two
  intended messages, no duplicate, two read notifications, zero unread count for
  both accounts, and no leaked cross-account draft.
- Original radio flags are restored. As in previous accepted evidence, Wi-Fi is
  enabled but the measured active route is cellular; identical association is
  not claimed.
- The original reviewed `local-chat-network-received.png` shows both messages,
  header, composer and bottom navigation. It replaces the older portal capture;
  the older evidence files remain unchanged in their dated directory.

## Not Proven

Preparation already contains both transports, an available cellular callback,
SIM-ready/data-connected state and a valid default data subscription. The
read-only always-on setting is observed as `1`. The test did not change that
setting. This run does not reproduce the earlier Wi-Fi-only preparation failure,
so it does not establish why that failure occurred or prove deterministic setup.
The failed attempts and diagnostic-reader red/green evidence remain in
`../local-app-scheduling-2026-10-16/`. No timeout, assertion, case count or required
offline state was relaxed to obtain this result.

There is no physical-device, live payment, push, GPS, full conversation process
restart, token-expiry, post-commit acknowledgement-loss or team-group evidence.
The agreed team audience includes verified parents of enrolled children, but the
team conversation feature is not implemented. The older SlotWriter investigation
remains open. The app and rules are not deployed to production. Release manifests
and the portal's partial message-flow status remain unchanged.
