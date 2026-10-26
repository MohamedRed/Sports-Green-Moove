# Terminal Native Copy Disconnect, 26 October 2026

Original Native CI run `40389650724`, source
`ed851b777d31aba91e74274bce872bf1cfa8d527`, finishes in failure. Its main job
`121806982930` fails during `Run Android Compose UI tests`; artifact
`12685851499` is retained successfully. All eleven focused lanes succeed.
The original ordinary XML and report contain 231 cases: 177 passed, 54 skipped,
zero failed. Suite exits are ordinary 0, component evidence 0 and local replay 1.
This is not a completed native gate, physical flow or release acceptance.

The primary `trip-consent-restart` file copy exits 1 while building its file list.
The immediately following directory, shell and sync queries report the device
offline. Guest logs show host-16 write failure, transport destruction, then a
new host-17 transport and authorization about half a second later. The normal
app-process socket closure line is not itself proof of the transport cause.
The separate cleanup copy later succeeds with 107 files; it cannot replace the
failed primary copy. Device policy restoration and package cleanup are verified.

Host before/after samples list the same four ADB PIDs and zero bounded log
signal counts. That does not exclude the observed disconnect or establish which
process owns the server or emulator transport. These originals have no socket
ownership samples. No daemon duplication, platform-tools bug, graphics failure,
server restart or application defect is established by them.

The subsequent diagnostic candidate reads same-user Linux ADB socket ownership
from process descriptors and the kernel's TCP tables. Only loopback/listener
metadata, ports, states, inodes, process identity and start ticks are retained.
It reads no process arguments, environments, socket payloads or other users'
connections. Missing, raced or unsupported observations stay explicitly unknown.
It sends no device/server command, adds no retry, changes no timeout, resets no
transport and does not replace collection. Its local parser/fixture tests are
not execution against a live CI server and not a repair of this failure.

The field layout is documented by the
[Linux kernel TCP table documentation](https://docs.kernel.org/networking/proc_net_tcp.html).
The [official ADB guide](https://developer.android.com/tools/adb) describes the
separate client/server/device roles. Those documents guide observation, not a
causal diagnosis of this run. Existing Backend/Web/Native test steps and QA path
filters cover the new collector and retained evidence. No workflow workload,
provider request, production setting, Terraform or public media is changed.

Preserve the earlier successful 1518a8b baseline, older failures and the separate
physical pairing/invitation evidence. The public news uses plain French; none of
these raw diagnostics is copied into the public Site snapshot.
