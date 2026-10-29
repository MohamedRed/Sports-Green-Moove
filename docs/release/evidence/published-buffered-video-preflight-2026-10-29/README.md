# Incomplete entry-document preflight

The first probe of published version 247 stopped before browser launch. Public
JSON matched, but the received entry HTML differed from the local file because
hosting injected markup. No playback/seek case was attempted or accepted.
`completed: false`, zero cases and `browserClosed: false` are preserved as observed:
no browser had been created. The later probe validates exact JSON/module bytes and
the actual DOM's module/CSP declarations rather than asserting identical HTML.
See `../published-buffered-video-2026-10-29/` for the separate successful run.
