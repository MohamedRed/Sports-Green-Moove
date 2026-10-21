# Rendered Counter Diagnostics, 21 October

The three-case trial on `b690c8e` still fails two layout assertions. The original
measurements distinguish the cause: `5 non lus` measures 144 x 45 with a maximum
width constraint of 2252; `99+ non lus` measures 243 x 59 with a maximum width
constraint of 692. Both report width overflow but no height overflow. Reviewed
original captures show the complete counters, including the narrow large-text
directory and the landscape count after retry. They remain retained-only because
their whole cases failed.

The installed AndroidX foundation 1.10.6 source reconstructs a MultiParagraph
from the original maximum constraints for String-text semantics, while retaining
the narrower measured layoutSize. Its paragraph-container width is not the
painted line width. The primary source is the published
[source archive](https://dl.google.com/dl/android/maven2/androidx/compose/foundation/foundation-android/1.10.6/foundation-android-1.10.6-sources.jar),
`ParagraphLayoutCache.slowCreateTextLayoutResultOrNull`.

The prepared assertion now checks complete text coverage, no exceeded maximum
lines, no ellipsis, and actual line left/right/top/bottom coordinates against
the measured text box. No clipping allowance, assertion skip, app-layout change,
timeout increase or capture fallback is added. Fresh execution is still required.

Original ZIP `12379404206`, API metadata, instrumentation, selected original
images and independent restoration receipts are retained with SHA-256 checks.
Temporary administration, policy, background settings and local packages are
verified restored/removed. No physical-device or release outcome is accepted.
