import assert from 'node:assert/strict';
import { deleteApp, getApp } from 'firebase-admin/app';
import { projectId } from './local-emulator-config.mjs';

export async function withLocalAdminCleanup(task, { firestore, app = getApp(), closeApp = deleteApp }) {
  assert.equal(app.options.projectId, projectId, 'Only the isolated QA application is owned by this lifecycle');
  assert.equal(typeof task, 'function'); assert.equal(typeof firestore?.terminate, 'function');
  assert.equal(typeof closeApp, 'function');
  const errors = []; let value;
  try { value = await task(); } catch (error) { errors.push(error); }
  // App deletion closes Realtime Database; Firestore has a separate public termination API.
  for (const close of [() => firestore.terminate(), () => closeApp(app)]) {
    try { await close(); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Isolated replay and admin client cleanup failed');
  return value;
}
