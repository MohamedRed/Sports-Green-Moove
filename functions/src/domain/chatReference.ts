import { z } from "zod";

export const chatDocumentIdSchema = z.string().min(1).max(256).regex(/^[^/]+$/)
  .refine((id) => id !== "." && id !== ".." && !/^__.*__$/.test(id), "Invalid document ID.");
export const chatReferenceSchema = z.object({ sourceType: z.enum(["booking", "rideSession"]), sourceId: chatDocumentIdSchema });
export type ChatReference = z.infer<typeof chatReferenceSchema>;
