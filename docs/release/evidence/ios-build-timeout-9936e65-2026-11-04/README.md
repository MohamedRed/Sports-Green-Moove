# Terminal iPhone preparation timeout at 9936e65

Run [41887949452](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41887949452),
job `126777365746`, source `9936e6512889f3ab1cace4931513460951fef37b`, is terminal
**cancelled**. Its authoritative annotation says the job exceeded 35 minutes.
Simulator disposal succeeds. This is not a missing handle or an observation timeout.

Native logic, the controlled location-provider check, strict callable signatures,
project generation and explicit simulator boot pass. Boot takes about eight
minutes. The build step is cancelled after about 23 minutes, following dependency
resolution and `CreateBuildDescription`; no successful SDK-linked build or fixture
execution is recorded. The test step is skipped, so none of the seven cases
executes; there are no XCTest case-result totals or new native captures.

The underlying preparation slowness remains unknown. The transcript alone does
not prove CPU contention, a provider outage, a compiler rejection or that changing
the boot order would repair it. The SDK dependencies were resolved from version
ranges, not a committed resolved lock. That reproducibility gap is separate from
the verified job-deadline termination.

`build-step.txt` is the unchanged selected member of the original ZIP, verified
with `unzip -t`. `summary.json` records its member/archive hashes and exact terminal
step metadata. No earlier passing fixture run accepts this candidate.

The user subsequently approved a **50-minute** maximum for future public runs,
without weakening tests or adding storage beyond three synthetic captures, one
day, at most 2 MB. This does not change the failed original result or increase an
already-running job's limit. Its new candidate still needs a complete run.
No automatic rerun, cache, skipped test or native-media acceptance is introduced.
