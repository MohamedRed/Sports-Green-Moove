# Failed system-image preparation before session-disconnect UI

Exact application head: 8b53925d55c7a450a0c4bc6d5ae124154a0e1265.
Native run 40411981666, isolated session-disconnect job 121884714747, 26 October.
The original job metadata is terminal failure. Its app/test compilation succeeded;
the subsequent device-preparation action failed installing the Android 35 Google
Play x86_64 system image, with "Error on ZipFile unknown archive". The selected
original log lines preserve their timestamps without including the complete log.

The action then attempted emulator cleanup and received connection refused on
port 5554. That cleanup attempt does not prove a device started, a successful
shutdown, app installation or an application assertion. No instrumentation marker,
flow checkpoint or app capture was produced by this job. It does not establish
a session-disconnect product regression, and it is not a passing user-flow test.
Other jobs were still running at observation; their outcomes are not inferred.

The downloaded archive, its response headers and bytes were not retained by the
runner. The precise cause of the invalid archive is therefore not established.
Earlier successful preparations and earlier independent failures remain distinct.
No retry, alternate image, mirror, permission change, timeout extension or skipped
assertion is introduced to make this gate pass. Existing physical-phone evidence
is unchanged. This record supplies no new media or release acceptance.
