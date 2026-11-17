import assert from 'node:assert/strict';
import { runIsolatedRideUi } from './run-isolated-ride-ui.mjs';

assert.equal(process.env.SGM_VEHICLE_MAP_UI, 'approved-sdk-map');
await runIsolatedRideUi('vehicle-map');
