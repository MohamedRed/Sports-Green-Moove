import { prepareContinuousDevice } from './continuous-disposable-device.mjs';

try { console.log(JSON.stringify(prepareContinuousDevice())); }
catch (failure) { if (failure.receipt) console.log(JSON.stringify(failure.receipt)); throw failure; }
