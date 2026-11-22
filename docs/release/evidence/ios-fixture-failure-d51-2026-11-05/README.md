# Terminal iPhone Fixture Results, 5 November 2026

Neither run accepts the full iPhone fixture gate, production services, physical
devices or release. No new capture run, storage expansion, deadline increase,
reduced case inventory or unchanged manual retry was launched for these results.

## EEF Partial Deadline

Run [42026680118](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/42026680118/job/127242518564),
source `eef1c4cb1f7b4f773ddfbf8a47a28e767a85564a`, is cancelled at the approved
50-minute job limit. SDK-linked compilation succeeds; one of eleven planned
fixture cases completes and passes. The personal-contact case starts but has no
terminal result in the retained log. Disposal succeeds and artifacts are empty.
Do not infer ten completed cases, a UI pass or a diagnosed timeout cause.

## D51 Complete Failure

Run [42030107261](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/42030107261/job/127268225474),
source `d51c0f8c50fd2c148bf751bec07a4a380bac0ae4`, finishes before the same
50-minute limit. SDK-linked app and all fixture bundles compile. All eleven cases
execute: eight pass, three fail, with five assertion failures in those three cases.

Passed: child contact opens without tracking/editing, personal contact review and
removal, verified-parent child selection/contact save, both search/consent cases,
profile sign-out, active-ride identifiers, and publish/search/booking identifiers.
These are synthetic fixture screens, not complete real-service user flows.

Failed:
- `testAuthFlowIdentifiers`: the city button is not found as `profile.city`.
- `testMessagesChatAndRatingIdentifiers`: draft value is `Message de test iso`
  instead of the full `Message de test isolé`; the expected full sent text is absent.
- `testSecondaryFlowIdentifiers`: the expected membership approval button is
  absent; the subsequent tap fails too. No manager decision is accepted.

The logs do not establish the root causes of those three failures. Do not replace
the exact full-text assertions, relax predicates, raise deadlines or count the
partially executed actions as successful. The earlier emergency alert/Back fixes
are exercised by passing cases here; the city/chat/manager journeys remain open.
The actual full source and unchanged eleven-case workflow are frozen separately
for each run. Both optional capture steps are skipped, the artifact inventory is
empty and simulator disposal succeeds. No new media is published.

`summary.json` binds the original terminal metadata, selected test lines and all
case outcomes. `source-sha256.json` binds the source at each actual tested commit.
The portal adds one concise incomplete-iPhone result while preserving every prior
record, date, status, image, tour, blocker and public access setting. Both current
automated iPhone manifest entries remain pending full gate acceptance.
