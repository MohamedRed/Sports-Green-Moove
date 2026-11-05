import {bookingServerRecheckProgress} from './booking-server-recheck.mjs';
import {latestIosProgress} from './progress-ios-latest.mjs';
import {verificationBoundariesProgress} from './verification-boundaries.mjs';

export const latestReleaseProgress = [verificationBoundariesProgress, bookingServerRecheckProgress, ...latestIosProgress];
