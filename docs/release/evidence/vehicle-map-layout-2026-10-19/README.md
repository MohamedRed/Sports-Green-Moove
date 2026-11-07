# Arrival Information Outside The Map

Two actual Compose component cases passed on the disposable local Android image:
a 320dp-wide screen at font scale 1.3 and a normal-width stale-state screen.
Both assert the arrival label/value stay within the viewport and below the map.
The old in-map overlay was removed rather than retaining duplicate information.
The original two window captures were reviewed; the narrow label wraps without
overlap. This component has no app bottom navigation by design.

These are simulated component screens, not authenticated app flows. The map
credential is absent intentionally and the screen explicitly says the map is
unavailable. No map renderer, tiles, moving marker, provider ETA or physical GPS
was exercised. The photos remain technical evidence, not new parent-flow photos
in the portal. Native compile and unit success do not close the map test.
