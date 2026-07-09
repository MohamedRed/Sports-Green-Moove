import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

export function parseCallableData<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  throw new HttpsError("invalid-argument", validationErrorMessage(result.error));
}

export function validationErrorMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request data.";

  const path = issue.path.map(String).join(".");
  return path
    ? `Invalid request data at ${path}: ${issue.message}`
    : `Invalid request data: ${issue.message}`;
}
