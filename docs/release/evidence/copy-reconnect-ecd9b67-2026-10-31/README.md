# Capacity passes; primary copy still fails

Source `ecd9b67058378f28e9be27a64fa771e2e13bdb7b`,
[Native CI 41247850105](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41247850105),
main job `124674908197`. Original main and focused ZIP sizes/digests independently
match provider metadata. Only selected original members and source digests are
retained; full archives stay private. No new public media or flow promotion.

All eleven focused jobs pass, including their separate fail-closed capacity
steps and device trials. The selected team-read capacity receipt confirms the
11 GiB reserve after SDK image installation. The main job also starts and passes
222 ordinary cases, with 54 explicit skips and zero failures, plus its component
captures. Neither selected host needed removal of the unused tool: available
space already exceeded the reserve. This proves execution of the guard, not its
low-space removal branch. The earlier capacity failure is preserved separately;
it is no longer the blocker in this run.

The main replay fails its primary `trip-change-parent-confirmation` copy with
exit 1, signal null. The same host server PID 3540/start ticks 35634 and listener
survive the sampled failure, but the original emulator peer socket disappears.
The first three diagnostic reads report device offline. The later limited
storage-service log succeeds and records guest adbd PID 1715 retiring connection
host-18, then opening host-19. A later cleanup copy succeeds on a new host peer
socket with a different inode. Its 97 files never replace or accept the failed
primary command. Independent test-package/policy/launcher restoration passes.

The repeated PID in the guest log is not a measured guest process birth or boot
identity, nor proof of continuous execution. These records do not identify who
closed the underlying connection or establish a repair. The full Native gate
remains failed. The actual emulator is already 37.2.13, so simply updating to
that patch is not a demonstrated fix for this failure. The
[official release note](https://developer.android.com/studio/releases/emulator)
describes a graphics-resource leak correction, not this observed transfer error.

## Next bounded observation

The account-free transfer diagnostic gains before/after guest boot-digest and
adbd PID/start-tick observations, plus an exact allowlist of daemon transport
events. It retains no raw boot identifier, authentication log, packet payload,
process arguments or environment. Changed or unreadable identity stays unknown;
matching samples never claim continuous execution or root cause. The original
32 fixed primary transfers, first-failure stop, deadlines and cleanup remain.
No retry, restart, alternate transfer or storage reduction is introduced.

The new observation has unit-contract coverage but is not claimed as executed
on a real Linux guest by this retained report. It is confined to the existing
disposable account-free diagnostic, not the app's full replay. All product,
physical tracking, actual payment, production and release requirements remain
separate. Preserve the public portal audience and every dated gallery/tour.
