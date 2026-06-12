import { z } from "zod";

const locationUpdateSchema = z.object({
  rideSessionId: z.string(),
  userId: z.string().optional(),
  role: z.enum(["driver", "child"]),
  lat: z.number(),
  lng: z.number(),
  accuracyM: z.number().nonnegative(),
  speedMps: z.number().optional(),
  headingDeg: z.number().optional(),
  batteryPct: z.number().optional(),
  capturedAt: z.number(),
  uploadedAt: z.number().optional(),
  source: z.enum(["radar", "nativeFallback", "manual"]).optional(),
});
const locationUpdatesSchema = z.array(locationUpdateSchema).min(1).max(100);
const locationBatchSchema = z.object({
  updates: locationUpdatesSchema,
}).strict();
const locationBatchJsonSchema = z.object({
  updatesJson: z.string().max(100_000).transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "updatesJson must contain a valid JSON update array",
      });
      return z.NEVER;
    }
  }),
}).strict().transform(({ updatesJson }) => ({
  updates: locationUpdatesSchema.parse(updatesJson),
}));
const locationBatchRequestSchema = z.union([locationBatchSchema, locationBatchJsonSchema]);

export type LocationBatchRequest = z.infer<typeof locationBatchSchema>;

export function parseLocationBatchRequest(data: unknown): LocationBatchRequest {
  return locationBatchRequestSchema.parse(data);
}
