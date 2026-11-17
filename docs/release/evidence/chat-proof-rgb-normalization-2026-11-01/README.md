# Three Reviewed Session Crops, 1 November

These are corrected lossless recrops of the same three session captures from the
1 November physical chat trial. They are not new phone trials, native exports,
new screenshots, radio-loss tests, provider delivery or release acceptance. The
original phone checkpoints, dates, 34-image gallery, 15-step tour and partial flow
status remain unchanged. All original source bytes and previous recrops remain
in the original evidence bundle, with their original checksums.

The original files have `.png` names but JPEG signatures. The earlier crop used
FFmpeg's default subsampled-YUV pipeline. The original command matched the stored
PNG on macOS, but failed on Linux at byte 79. The independent Linux diagnostic
41363818773 / job 125019644410 failed normally after bounded assertion reporting
was added; its failed result and allowlisted resource observations are retained
here. That successful failure reporting does not turn the failed crop into a
pass, prove the original shutdown's cause, or accept the primary smoke gate.

The primary crop procedure now explicitly decodes each full JPEG to RGBA with
locked `jpeg-js` 0.4.4, with strict decoding and bounded size/memory, then copies
the exact integer rectangle with `pngjs` 7.0.0 and writes a lossless PNG. It never
crops subsampled colour planes and has no alternative decoder, resize, colour
adjustment, tolerance or fallback. Every output RGBA byte must equal the same
rectangle in the fixed full-frame decode. Both raw source and decoded pixel
hashes are retained. A changed pixel or a coherently rehashed altered PNG must
still fail. Error reporting never formats entire frame buffers.

The three new crops were visually reviewed: the single confirmed parent bubble,
the same message after reopening, and the driver's incoming message are visible.
Only these reviewed crop files replace their previous public derivatives. The
old crops remain as historical renderer-dependent artifacts, not a portable
pixel-equivalence claim. No real user, account, map request, payment or phone
session was created for this correction. Linux acceptance still requires a
fresh run of the exact primary test command and the complete smoke job.
