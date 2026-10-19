# Functional Window-Copy Pass With Incomplete Rendering

The original Android case passed in 63.478 seconds and its host completed the
isolation, permission, package and whole-environment lifecycle checks. Visual
review still rejected the active-ride images because their navigation was absent.
Changing the copy source alone did not resolve the rendering discrepancy. No
image in this set is promoted to the partner portal.

Inspection of the installed AndroidX 1.10.6 source shows that its standard capture
enables `HardwareRendererCompat` drawing and forces a redraw of the window decor
before copying. The independent helper had awaited only the Compose view frame,
without those two steps. The revised helper adds the same rendering prerequisites,
restores the observed drawing policy in `finally`, and still performs only one
bounded window copy. It does not add a secondary screenshot path or change any
application assertion. A complete new run and visual review remain required.
