# Later passing iPhone observation

Source `0fb9968afecd3a8988c22db197f00159c140fa4f`, run `42277045115`, job
`128100638202`: SDK build, all eleven original screen cases and disposal pass.
Optional captures are skipped and the artifact inventory is empty.

This completes after the retained source-964 membership failure. All iOS files
and the iPhone workflow are byte-identical between those two source commits:
`git diff --exit-code 9640d8b 0fb9968 -- ios .github/workflows/ios-mvp-verification.yml`
returns zero. The two observations do not establish why membership selection
failed previously or prove repeatability. Both remain in the history.

The current diagnostic candidate changes only `MembershipFlowChecks.swift`
within the iPhone input tree. That complete SDK/UI run remains separate. This
historical passing record does not relabel the current manifest or replace its
source-matching requirement, the original eleven cases or 50-minute limit.
Physical, operational, live-service, safety and release acceptance remain open.
