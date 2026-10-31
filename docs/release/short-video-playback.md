# Short video playback

The owner approved fully buffering the five existing excerpts on 28 October 2026.
Each is limited to 240,000 bytes. Full recordings remain direct links and are not
buffered by the player. Public Site access and original download URLs are unchanged.

The player accepts only manifest-listed excerpts, an exact HTTP 200 MP4 response,
the approved byte count and the existing SHA-256 digest. It enables playback after
decoding a verified Blob. Media policy permits Blob sources; scripts and network
connections remain same-origin. Leaving a view cancels loading, stops playback and
revokes its temporary URL. Errors do not switch to an alternative delivery path.

Run unit coverage with:

```sh
node --test tests/short-video-loading.test.mjs tests/short-video-lifecycle.test.mjs
```

After building, run the full portal browser suite and the bounded probe:

```sh
node tests/partner-portal.browser.mjs
node scripts/qa/record-buffered-media.mjs http://127.0.0.1:4177 /absolute/new-output
```

The probe also accepts the exact public Site origin. It verifies five assets at
1440, 768, 390 and 320 pixels. Four clips are exercised in their actual gallery or
tour. The unlisted parent-guard asset is tested separately through the deployed
player module, not presented as a visible user flow. It records playback, seeking,
nonblank pixels, unchanged downloads for visible clips, cancellation cleanup,
source fingerprints and browser closure. Published success must be retained
separately from the original 28 October seek failure. This is website evidence,
not mobile user-flow or physical release-readiness evidence.
