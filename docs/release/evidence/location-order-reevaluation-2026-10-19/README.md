# Transaction Reevaluation Clock

Review of the first ordering repair found a second race: its comparison clock was
sampled before the transaction. When the database reevaluated that transaction
after a newer capture arrived, the newer capture could appear future relative to
the old comparison time. The controlled writer test reproduced that failure;
`before-unit.xml` retains three cases with one failure and the original source.

The transaction now reads the comparison clock on each callback execution.
`full-functions.xml` retains all 341 passing function cases, including the twenty
ordering policy cases and three writer protocol cases. The protocol test uses a
controlled database adapter to invoke the actual production callback twice as
time advances; it does not claim a physical or real-network race trial.

`services.json` and `services.txt` are a new independent run of the same ten-group
actual isolated service replay after this final source change. The run identity
differs from the first repair. The administrative client closed before the report
was written, the script exited zero, and all owned emulators stopped. Exact
source bytes and raw artifacts are hash-bound. The first passing ten-group replay
and its limitations remain retained separately rather than being overwritten.

This is local data/writer evidence only. No phone UI, physical GPS, signed live
webhook, child-device authorization, production deployment, accepted safety audit
or store-review requirement is proved. Continuous UI/map refresh, ETA ordering,
provider timestamp provenance and clock-skew UX remain open.
