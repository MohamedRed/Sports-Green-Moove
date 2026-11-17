package be.sportgreenmoove.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RouteMapViewportTest {
    @Test fun fittedEndpointsHaveRoomForBothMarkerHeads() {
        assertTrue(routeMapAnchorsFit(listOf(126 to 126, 784 to 530), 910, 656, 126))
        assertFalse(routeMapAnchorsFit(listOf(455 to 0, 455 to 530), 910, 656, 126))
        assertFalse(routeMapAnchorsFit(listOf(0 to 126, 784 to 530), 910, 656, 126))
        assertFalse(routeMapAnchorsFit(listOf(126 to 126, 910 to 656), 910, 656, 126))
    }
    @Test fun resizingRequiresTheNewViewportAndAllowsOnlyPixelRounding() {
        assertTrue(routeMapAnchorsFit(listOf(55 to 55, 345 to 545), 400, 600, 56))
        assertFalse(routeMapAnchorsFit(listOf(54 to 55, 345 to 545), 400, 600, 56))
        assertFalse(routeMapAnchorsFit(listOf(126 to 126, 784 to 530), 400, 656, 126))
    }
    @Test fun absentOrUnusableLayoutCannotClaimFraming() {
        assertFalse(routeMapAnchorsFit(emptyList(), 910, 656, 126))
        assertFalse(routeMapAnchorsFit(listOf(100 to 100), 0, 0, 126))
        assertFalse(routeMapAnchorsFit(listOf(100 to 100), 200, 200, 126))
        assertFalse(routeMapAnchorsFit(listOf(100 to 100), 910, 656, 0))
        assertTrue(routeMapAnchorsFit(listOf(455 to 328, 455 to 328), 910, 656, 126))
    }
}
