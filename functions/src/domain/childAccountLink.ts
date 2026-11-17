import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";

export const childAccountLinkSchema = z.object({
  accountUserId: chatDocumentIdSchema,
  childId: chatDocumentIdSchema,
  childInstanceId: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["verified", "revoked"]),
  verifiedAt: z.instanceof(Timestamp),
  verifiedByUserId: chatDocumentIdSchema,
}).strict();
