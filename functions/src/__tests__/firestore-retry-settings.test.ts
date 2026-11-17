import { expect, it, vi } from "vitest";

const settings = vi.hoisted(() => vi.fn());
const initializeApp = vi.hoisted(() => vi.fn());
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ settings }) }));
import { firestore } from "../lib/firestore.js";

it("configures the primary shared client for status-aware streaming before use", () => {
  expect(firestore.settings).toBe(settings);
  expect(settings).toHaveBeenCalledExactlyOnceWith({ gaxServerStreamingRetries: true });
  expect(initializeApp).not.toHaveBeenCalled();
});
