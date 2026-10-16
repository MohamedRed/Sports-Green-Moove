import { createHash } from "node:crypto";
import { z } from "zod";
import { chatDocumentIdSchema as documentId } from "./chatReference.js";

const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict();
const isoDate = z.iso.datetime({ offset: true });
export const tripChangeTermsSchema = z.object({
  departureAt: isoDate, arrivalBy: isoDate.nullable(), origin: point, destination: point,
  priceCents: z.number().int().min(0).max(100_000),
}).strict().refine((terms) => !terms.arrivalBy || Date.parse(terms.arrivalBy) >= Date.parse(terms.departureAt),
  "Arrival must not precede departure.");
export const tripChangeReferenceSchema = z.object({ tripId: documentId, proposalId: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const tripChangeProposalSchema = z.object({ tripId: documentId, requestId: z.uuid(),
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/), terms: tripChangeTermsSchema,
}).strict();
export const tripChangeDecisionSchema = tripChangeReferenceSchema.extend({
  requestId: z.uuid(), proposalRevision: z.string().regex(/^[a-f0-9]{64}$/), decision: z.enum(["accept", "decline"]),
}).strict();
export const tripChangeWithdrawalSchema = tripChangeReferenceSchema.extend({ requestId: z.uuid() }).strict();

export function tripChangeHash(value: unknown): string {
  function canonical(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(canonical);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, item]) => [key, canonical(item)]));
    }
    return input;
  }
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function tripChangeSourceData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !["pendingChangeId", "updatedAt"].includes(key)));
}

