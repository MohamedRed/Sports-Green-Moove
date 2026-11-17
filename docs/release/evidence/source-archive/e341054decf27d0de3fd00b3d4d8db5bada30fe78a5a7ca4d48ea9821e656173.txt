import { z } from "zod";

export const supportMailConfigSchema = z.object({
  from: z.email().max(254),
  to: z.email().max(254),
  adminOrigin: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  }),
}).strict();
export type SupportMailConfig = z.infer<typeof supportMailConfigSchema>;
export const supportMailApiKeySchema = z.string().regex(/^re_[A-Za-z0-9_-]{16,}$/);
export const supportUrgentMessageSchema = z.object({ from: z.email(), to: z.array(z.email()).length(1),
  subject: z.literal("SPORTS GREEN-mOOVe : demande urgente"), text: z.string().min(1).max(1000) }).strict();
export const supportEmailWindowMs = 23 * 60 * 60_000;
export const supportEmailLeaseMs = 2 * 60_000;

export function supportUrgentMessage(reportId: string, config: SupportMailConfig) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) throw new Error("Invalid support reference");
  const destination = supportMailConfigSchema.parse(config);
  return { from: destination.from, to: [destination.to], subject: "SPORTS GREEN-mOOVe : demande urgente",
    text: `Une demande urgente attend le support.\n\n${new URL('/#support-report-' + reportId, destination.adminOrigin).href}\n` };
}

export type SupportUrgentMessage = ReturnType<typeof supportUrgentMessage>;
