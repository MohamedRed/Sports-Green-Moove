# Form Feedback Foregrounds, 3 November 2026

The actual login, search and conversation status labels use fixed brand orange
before this correction. Ten local colour cases reproduce five light-theme failures:
2.5976747316252924:1 against the unchanged 4.5:1 requirement. Original sources,
JUnit and measurements are retained. The added baseline test is archived separately;
it was not already part of source base `09008cb4388a50b937e0eda86c01942cc0590dbd`.

Login/search failures and invalid or unconfirmed messages use the existing
semantic error colour. A valid message being sent uses the existing secondary
text colour. Invalid length still takes priority over sending; sending still takes
priority over an earlier error. Only foreground expressions and the unused search
colour import change. Text, sizing, fields, callbacks, buttons, persistence,
network operations, palette definitions and branded surfaces are unchanged.

All ten revised pairs pass, with minimum contrast 6.092589354752622:1. All 830
local Android unit cases pass across 117 suites. The actual app and test APKs
compile. This is colour/unit and compilation evidence, not rendered acceptance.

Four native cases inspect twenty viewports using the production OnboardingScreen,
SearchScreen and ConversationComposer, synthetic inputs, both themes, 320 x 700
and 900 x 600 viewports, and font scale 1.3. They require full measured text,
viewport bounds, the actual semantic foreground and contrast >= 4.5:1. Sending
keeps an earlier error in the fixture so status priority is observed. Limit/sending
disable the send action; an unconfirmed message retains its retry action.

Each passing viewport retains an original viewport/window pair and hash-bound marker
under the existing feedback export. Primary collection requires all sixty new
files, independently of the twelve earlier feedback views. Failure keeps partial
files separate; it cannot accept missing files, a later alternate copy or changed
deadlines. Sixty missing-file shell cases are added without removing old checks.
Each theme/size case reuses its activity for all five states, with keyed fresh
compositions. The twenty views and all assertions remain required; the unchanged
12-minute ordinary-suite deadline is not widened to cover extra activity launches.

Review the actual completed native run and images before publishing new captures
or claiming authentication, search, message delivery, physical accessibility or
release acceptance. The prior 09008cb main native attempt failed in dependency
resolution before device startup; unchanged build inputs and local availability
do not establish its cause or a repair. This colour correction is unrelated to it.

Existing native/web feedback-contract commands cover the new validation; web path
triggers are extended for the three production screens and new Kotlin tests. No
new workflow step, provider call, paid resource, fallback or Terraform is added.

All 4,153 local Node cases pass, including the sixty missing-file cases and
unchanged workload fingerprints. Grouped native app/test APK compilation passes
in 18 seconds. Native execution and visual review remain pending; no new public
image, flow status or physical-test date is accepted by this preparation.
