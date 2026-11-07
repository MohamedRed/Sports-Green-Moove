# iPhone Emergency Contact Candidate

Source audit at `75440a26eae0348517fc23bebc720c41f3cf46b2` found a fixed example
number in settings and a noninteractive emergency row in the active ride. Neither
was a working emergency action. Both are replaced, not retained as fallbacks.

The candidate reads the private contact service, validates the actor, target,
revision and immutable child identity, and binds every operation to the original
account generation. Adults can review, save or remove their own contact. A child
has a separate read-only current-ride lookup directly from Home, without starting
tracking or requesting location. No contact or ride absence invents a number.
Manager-verified parent selection/editing of a child's contact is still not exposed
on iPhone and remains required; the shared wire supports that existing protocol.

Every phone action re-reads current authority and compares the complete displayed
contact/child identity. A change needs another tap; failed verification hides the
private values. Unsaved edits disable dialing. Closing, backgrounding and account
or role changes invalidate pending results. Unknown writes require an explicit
read before another edit; no write is automatically resent. Confirmation binds an
immutable operation rather than the later editable form. Removal keeps a revision.

Executed controlled checks cover 22 malformed wire cases, strict international
phone/name validation, 36 delayed read/write/dial success/error boundaries and six
late opener callbacks. The complete native logic plan and actual callable adapter
signature check pass. The actual native phone adapter also executes against a
controlled UIKit boundary: four unsafe inputs denied, one exact `tel` request,
and a rejected opening without retry. This is not a real Phone handoff or call.
Apple documents user confirmation for native `tel` links on supported iOS versions:
https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html

Two additive UI cases are prepared: reviewed personal save/removal after reopening,
and read-only child access from Home. They do not open Phone, capture images or
replace any earlier fixture. The complete required fixture inventory is now ten.
These screens and the complete new app still need an SDK build and native UI run;
no new capture is published or visual/physical/store-action acceptance is added.
The separate eight-case 4582c3a success does not contain this candidate.

Original controlled logs and content-addressed source inputs are retained.
The previous shutdown evidence is preserved unchanged; its source-hash check now
uses its exact 4582c3a archived inputs instead of incorrectly requiring every future
app revision to match it. Current behavior assertions and all original UI cases
remain required. No production writes, real accounts, payments or paid resources.
