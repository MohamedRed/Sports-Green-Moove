# Invitation Binding And Role Recheck

Two additional fault tests found unsafe behavior in the unshipped local candidate:

1. Removing the private origin record allowed approval against another child
   profile. The original failed trial completed thirteen preceding groups and
   observed the wrong-profile approval. The entire owned environment was destroyed.
2. Removing child role claims before profile initialization caused the existing
   ordinary-user parent default to promote the invited account. The failed trial
   completed eight preceding groups and observed that promotion. Claims/profile
   restoration and owned environment destruction completed.

Both original negative reports, source bytes and disposal receipts are retained.
They are not successes and do not describe production mutations.

The repaired service replay passes all eighteen groups with both fault flags
false. Invited identities now have matching server-owned profile, origin, claim
and approval-request fingerprints. Missing or inconsistent bindings fail closed.
The origin, accepted invitation, immutable child identity and club are rechecked.
Profile fingerprints cannot be changed directly, even by an administrator.

Child-associated role initialization now validates existing claims and stored
roles before any ordinary signup default or claim write. The regular adult
signup policy and an explicit consistent administrator role decision are not
redefined. Android also rejects malformed, contradictory, unknown or mixed
child/adult profile roles instead of displaying a parent session.

Sixteen focused backend unit cases, six additional Android Auth wire cases and
208 rules cases pass. The earlier ten invitation-state cases retain their scope.
Three new Android component methods remain compiled-only in this record. The web
review is still mocked. No connected browser signup, real share chooser, complete
phone journey, iOS, production deployment, new gallery media or release acceptance
is implied. Candidate source is bound by hashes, not the earlier PR head.
