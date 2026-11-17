# Published Short-Clip Seeking, 28 October

The public progress Site plays the existing ten-second support excerpt, but its
unchanged seek check fails at 1440 pixels. The probe requests 8.8 seconds and
waits the original 30 seconds; the player instead remains near the beginning.
Playback passes before that seek. The whole clip is buffered, the player reports
no media error and its seekable interval is `[0, 0]`. Other widths are not proven.

A `Range: bytes=0-15` request receives HTTP 200 with all 67,043 original MP4 bytes,
not an HTTP 206 range. No `Content-Range` or `Accept-Ranges` is returned. The
received bytes match the existing reviewed clip and are retained with checksums.
The browser is independently closed; the probe changes no player source, access
policy, video file, timeout or fallback. This is a progress-site media limitation,
not a failed mobile support submission or proof of a codec defect.

`record-published-media-seek.mjs` reproduces and records the original playback and
seek conditions. The full unchanged browser suite passes against the range-capable
local preview; the published seek remains failed. A short-clip buffering change
was proposed to the user, but is not approved or implemented in this evidence.
