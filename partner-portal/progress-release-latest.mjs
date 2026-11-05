import {bookingServerRecheckProgress} from './booking-server-recheck.mjs';
import {latestIosProgress} from './progress-ios-latest.mjs';

export const latestReleaseProgress = [bookingServerRecheckProgress, ...latestIosProgress];
