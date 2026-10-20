import { prepareContinuousDevice, continuousSetupFailureReceipt } from './continuous-disposable-device.mjs';

try { console.log(JSON.stringify(prepareContinuousDevice())); }
catch (failure) { console.log(JSON.stringify(continuousSetupFailureReceipt(failure))); throw failure; }
