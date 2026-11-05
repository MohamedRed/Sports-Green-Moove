import {bookingServerRecheckProgress} from './booking-server-recheck.mjs';
import {latestIosProgress} from './progress-ios-latest.mjs';
import {verificationBoundariesProgress} from './verification-boundaries.mjs';
import {verificationFollowupProgress} from './verification-followup.mjs';

export const latestReleaseProgress = [verificationFollowupProgress, verificationBoundariesProgress, bookingServerRecheckProgress, ...latestIosProgress];
