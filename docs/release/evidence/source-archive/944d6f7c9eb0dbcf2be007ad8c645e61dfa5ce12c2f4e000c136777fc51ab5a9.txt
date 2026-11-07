import { z } from "zod";

export const isWellFormedUtf8 = (value: string) => Buffer.from(value, "utf8").toString("utf8") === value;
export const firestoreDocumentIdSchema = z.string().min(1).max(1500).regex(/^[^/]+$/).refine((id) =>
  isWellFormedUtf8(id) && Buffer.byteLength(id, "utf8") <= 1500 && id !== "." && id !== ".." && !/^__.*__$/s.test(id));
