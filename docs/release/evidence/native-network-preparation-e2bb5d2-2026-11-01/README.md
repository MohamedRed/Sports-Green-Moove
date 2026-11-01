# Complete Native Gate Recheck — 1 November 2026

Source `e2bb5d264a158137624ed041300acdc370061103`, completed run
`41319436417`, is **failed**. The main native UI job passes: 232 ordinary passes,
54 intentional skips, zero failures, component capture and connected replay exit
statuses zero. The private-storage case passes. This does not execute the later
uncommitted sign-out changes or prove that intermittent capture failures are fixed.

Ten of eleven isolated lanes pass. `chat-network-recovery` fails at its 30-second
network-preparation wait (`LocalChatNetworkFlowTest.kt:83`), before radio loss or
message retry. Earlier passive Wi-Fi readiness passes; the later requested setup
has one Wi-Fi callback but no cellular callback. The backend remains reachable.
These observations do not establish the root cause or a chat retry result.

Original selected transcripts, structured observations, artifact metadata and
source hashes are retained. Both device-restoration receipts verify cleanup.
The artifact archive digests are provider metadata, not independently matched
raw ZIP bytes. No diagnostic image is published. Preserve the earlier `94a3ffb`
PixelCopy failures and `d476cce` complete pass; neither is this latest result.
