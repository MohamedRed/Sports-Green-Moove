# Framed Real Maps And Native Application: Passed Locally

Native CI [39125211691](https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39125211691)
completed successfully at source `ff20fffa07d5da5f020e7b7b9252afe50bf1631a`.
Artifact `12135474645`, `android-approved-real-maps-ui`, contains thirteen
unchanged originals. Their bytes and the separate reviewed acceptance record
are pinned by `artifact-sha256.json`. Earlier failed and clipped-map runs remain
unchanged in their own directories and are not retroactively accepted.

Run `1c89c695696a0749269414d3a732b18a` passed its one native case in 68.197 seconds.
The native/persisted stage completed at `2026-10-18T12:06:13.873Z`; the independent
provider, persistence, raster and framing join passed at `12:06:15.265Z`.

The actual app selected and resolved Gare de Wavre and Gare de Louvain-la-Neuve,
proposed the changes, switched between both parents for separate agreements,
then returned to the driver to quote and apply. The original trip stayed stored
until application, parents had no application controls, and both bookings were
revised after application. All five allowed Places/Routes requests returned 200.
Selected IDs, provider coordinates, 7,512 metres, 580 seconds and polyline hash
`e8453752addcb81ec7ce996e633ec4a83d9f3ef9eef8b56c6dc461a44ca2890b` match the saved
trip. The native quote text is `7512 m · 9 min`.

## Visual Review

The original 1080 x 2400 native display shows both the initial and proposed
maps. Both complete red marker heads are visible on the proposed map, with
Wavre above Ottignies-Louvain-la-Neuve. The exact 910 x 656 raster crop retains
the complete pins and actual roads/labels. SDK loading and padded anchor
projection both passed. Its central raster has 13,563 samples, 185 colour bins
and a 0.4433384944 dominant-bin fraction. No imagery, pixels, thresholds or
provider responses were replaced to pass the check.

The separate original applied capture shows `Nouveaux détails appliqués` and
`Accords reçus : 2 / 2`. Its lower map is partially below the scroll viewport;
that image alone is not framing proof. The full native display/crop and native
projection receipt provide the framing proof instead. The selected-address
capture and applied capture are original 1080 x 2201 app-window screenshots.
These images verify map tiles, stations and marker framing; they do not add a
separate claim that a route line was visually inspected after application.

## Boundaries

The primary six-file ADB transfer returned zero without retry. Original store
background policy was restored and verified at unchanged service version
`26.40.32`, with Maps and location enabled. The whole map job passed, not just
its instrumentation command. No fallback, extra request allowance, key-policy
change, cloud write, charge or refund was introduced.

This is an Android emulator and isolated-service test with actual map providers,
not a physical phone, iOS, GPS/background tracking, payment/refund or production
deployment. It does not accept any final real-device or safety-audit manifest
item. The routine offline UI matrix is a different run and must be inspected
separately before claiming all checks pass. No Terraform resource changed.
