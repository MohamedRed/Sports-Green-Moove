# Feedback Text Contrast

The remaining appearance checks exposed unreadable small feedback text. Existing
runtime notices, stale-ride labels and review errors used fixed brand colours as
foregrounds on theme-dependent pale surfaces. The existing accent-control fix
explicitly did not accept warning/error text or whole-app accessibility.

## Reproduction And Correction

The new actual JVM regression executes against the untouched production sources
at `4a71fc24437f57871d4799f31cf1245378f6ade5`. Its raw 28-case report retains
18 failures: all fourteen light-theme pairs and four dark error pairs. The
production source files match that committed boundary; the new test itself is
an added probe, not falsely attributed to the earlier hosted run.

The correction uses semantic warning/error foregrounds and the existing green
text role. Brand colours, card backgrounds, gradients, handlers and business
logic remain unchanged. Material error foregrounds have matching on-error content
colours. The same 28 vectors keep their backgrounds, thresholds and ratio formula;
only their foreground references change to the production roles. Two explicit
on-error container/content pairs are added, making thirty passing cases.
The original test source and failed report remain retained. No assertion threshold
is lowered, ratio rounded, failure skipped or capture replaced.

The full local JVM run passes all 820 cases in 116 suites with no skips/errors.
Both isolated debug APKs compile. Their hashes and the compiled void-method
signature are retained. Eight new component cases compile for light/dark mode,
320 by 700 dp at density 3 and 900 by 600 dp at density 1, with font scale 1.3.
They render the actual notices, review card, active-ride entry, status badge and
Material error input, and use direct viewport/window captures with byte binding.
They make no application backend calls and render no map.

## Not Yet Proven Here

This bundle records unit measurements and a compiled capture plan only. The
eight native layouts have not executed at this boundary. It adds no accepted
screenshots, physical phone test, real backend flow, screen-reader, system-inset,
other coloured-text, gradient or whole-app accessibility result. Separate
source-bound native execution and visual review are needed before publication
of new images. All broader user-flow release requirements remain open.

The existing collector requires the new component evidence after a successful
ordinary suite, without replacing any older capture. Native CI and Web
Integration Smoke add one contract command; all 111 original and 153 retained
smoke workloads and 19 uploads stay unchanged. No deadline, provider setting,
network fallback, production resource or Terraform change is introduced.

The first full Node validation reports twelve shell-harness failures because its
fake output tree lacked the newly mandatory feedback files. The original failure
names, full private TAP digest and both harness sources are retained separately.
The fixture now supplies those explicit test-only files and additionally checks
all 24 missing-file combinations plus failed fresh-copy handling. Original exit,
replay and restoration assertions are unchanged; none is relaxed or skipped.
The final full local Node run passes all 3,986 cases, with its summary and private
full-report digest retained. That result still does not execute the native layouts.
