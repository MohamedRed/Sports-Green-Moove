# Subsequent Network Preparation Failure

Workflow `42111120300`, job `127538625233`, source
`d56cec66555cfb69a9f5ca336a637f99917376ed`, fails one native case during its
unchanged 30-second network-preparation predicate (test line 83), before any
radio cut, handover, offline retry or independent exchange verification.

Validated Wi-Fi and backend reachability are observed, but there is no default
data subscription and zero cellular availability callbacks. This is an observed
prerequisite failure, not an established subscription root cause or a regression
in message storage. The earlier successful 38b run had a valid initial data
subscription. It remains successful for that exact run only; this later failure
prevents claiming repeatability or current whole-workflow success.

Artifact `13455233548`, 366341 bytes, has SHA-256
`0076965dedc3babd21918cf73ea8a1d29b62525400eb8d51d21af41d350f4a43`.
Six original JSON/transcript members are bound byte for byte. Device cleanup
reports test packages removed, temporary administrator/component removed and
the original policy restored. A separate passive host receipt observes exit
without signals/device commands. Neither cleanup nor earlier successful images
accepts this failed recovery. No new images, phone, DNS policy, retry, deadline,
provider call, production write or release acceptance is added.
