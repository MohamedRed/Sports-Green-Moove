# Original Visual Trial Startup Failure

The original trial compiled and installed the local APKs but Android reported
`Process crashed` before the scenario started. No capture directory or completed
device marker existed. The host retained the failed instrumentation output,
original command, exact source snapshots, APK hash and read-only process data.
This is negative setup evidence, not a passed flow.

Android's exit information recorded a background startup ANR. Its preserved
DropBox trace shows the main thread loading/decompressing dex files while CPU
pressure exceeded ninety percent; other Android services also had startup ANRs.
The initial disposable VM used two CPUs, 2048 MiB and software rendering. The
subsequent explicitly provisioned VM uses four CPUs, 3072 MiB and host rendering.
No assertion, scenario or application startup timeout was relaxed.

Any later trial must have a new run identity, complete its own original scenario,
pass its primary capture transfer and independently verify stored state and
cleanup. The diagnostic files here cannot be reused as positive evidence.
