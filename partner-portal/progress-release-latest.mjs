import {bookingServerRecheckProgress} from './booking-server-recheck.mjs';
import {latestIosProgress} from './progress-ios-latest.mjs';
import {verificationBoundariesProgress} from './verification-boundaries.mjs';
import {verificationFollowupProgress} from './verification-followup.mjs';
import {ios584FixtureResultProgress} from './ios-584-fixture-result.mjs';
import {ios6e89FixtureResultProgress} from './ios-6e89-fixture-result.mjs';
import {publicationPriceProgress} from './publication-price.mjs';
import {iosViewportRecheckProgress} from './ios-viewport-recheck.mjs';

export const latestReleaseProgress = [iosViewportRecheckProgress, publicationPriceProgress, ios6e89FixtureResultProgress, ios584FixtureResultProgress, verificationFollowupProgress, verificationBoundariesProgress, bookingServerRecheckProgress, ...latestIosProgress];
