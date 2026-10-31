import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

const unsafeText = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/u;
export const profileCityLabelSchema = z.string().max(100).refine((value) => !unsafeText.test(value))
  .transform((value) => value.trim().normalize("NFC")).pipe(z.string().min(1).max(100));
export const profileCityReadSchema = z.object({}).strict();
export const profileCityWriteSchema = z.object({
  city: profileCityLabelSchema.nullable(),
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
  requestId: z.uuid(),
}).strict();
export type ProfileCityWrite = z.infer<typeof profileCityWriteSchema>;
export const profileCityRecordSchema = z.object({
  userId: z.string().min(1), city: profileCityLabelSchema.nullable(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  lastRequestId: z.uuid(), lastFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  updatedAt: z.instanceof(Timestamp),
}).strict();
export const profileCityFingerprint = (input: ProfileCityWrite) => createHash("sha256")
  .update(JSON.stringify([input.expectedRevision, input.city])).digest("hex");
