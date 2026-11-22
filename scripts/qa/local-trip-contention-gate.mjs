import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Transaction } from 'firebase-admin/firestore';
import { observeLocalTransactionRpc } from './local-contention-rpc.mjs';

export async function overlapCancellationAndApproval(tripId, cancel, approve) {
  const context = new AsyncLocalStorage(), reads = [], rpc = [], originalGet = Transaction.prototype.get;
  const stopObserving = observeLocalTransactionRpc(context, rpc);
  let cancellationRead, releaseCancellation, gatedCancellation = false, observedApproval = false, gateTimedOut = false;
  const cancellationHeld = new Promise((resolve) => { cancellationRead = resolve; });
  const approvalStarted = new Promise((resolve) => { releaseCancellation = resolve; });
  const watchdog = setTimeout(() => { gateTimedOut = true; releaseCancellation(); }, 10_000);
  Transaction.prototype.get = async function (reference, ...options) {
    const operation = context.getStore();
    if (!operation) return originalGet.call(this, reference, ...options);
    const path = reference.path ?? reference._queryOptions?.collectionId ?? 'query';
    reads.push({ operation, path, phase: 'requested' });
    const firstApproval = operation === 'approval' && !observedApproval;
    if (firstApproval) {
      observedApproval = true;
      // Trip-first contenders must not wait on a lock held by the test's gate.
      if (path === `trips/${tripId}`) releaseCancellation();
    }
    let result;
    try { result = await originalGet.call(this, reference, ...options); }
    catch (error) {
      reads.push({ operation, path, phase: 'failed', code: error.code, message: error.message });
      throw error;
    }
    reads.push({ operation, path, phase: 'completed' });
    if (firstApproval) releaseCancellation();
    if (operation === 'cancellation' && !gatedCancellation && path === `trips/${tripId}`) {
      gatedCancellation = true;
      cancellationRead();
      await approvalStarted;
    }
    return result;
  };
  let settled;
  try {
    const cancellation = context.run('cancellation', cancel);
    await Promise.race([cancellationHeld, cancellation.then(() => {
      throw new Error('Cancellation returned before reaching its trip read');
    })]);
    const approval = context.run('approval', approve);
    settled = await Promise.allSettled([cancellation, approval]);
  } finally {
    clearTimeout(watchdog);
    Transaction.prototype.get = originalGet;
    stopObserving();
  }
  assert(gatedCancellation && observedApproval && !gateTimedOut, 'The requested overlap must actually occur');
  return { reads, rpc, settled, gateTimedOut };
}
