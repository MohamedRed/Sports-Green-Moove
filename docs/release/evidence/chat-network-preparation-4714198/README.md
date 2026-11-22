# Chat Network Preparation Failure

Original artifact android-focused-safety-ui-chat-network-recovery, artifact ID
12972912081, run 41046340739, source 471419812a0300e72f86d02a451c9d151af4ed7f.
Job: https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41046340739/job/124031246527

The independent chat case fails at LocalChatNetworkFlowTest.kt:82 while waiting
30 seconds for prepared network evidence. The original report has completed=false,
failedPhase=network-preparation and an empty network sequence. Offline send,
recovery, explicit retry and the account exchange never execute in this attempt.
This is not an application chat-delivery failure or a completed radio test.

Both Wi-Fi and cellular requests receive one available callback. Cellular is the
active, validated Internet transport. Wi-Fi is available with Internet capability
but remains unvalidated in initial/preparing/preparation-failed snapshots.
The actual backend is reachable. These observations do not establish why Android
does not validate/select Wi-Fi, and do not justify bypassing the preparation gate.
No retry, timeout extension, transport fallback or success reclassification is made.

Both network requests are released. The separate device-restoration receipt says
restored=true and verified=true, with local packages and temporary installation
administration removed and original policy restored. Restoration does not pass
the failed flow. The aggregate focused-safety gate also fails because of this case.
The main native UI job was still running when these artifacts were collected.
