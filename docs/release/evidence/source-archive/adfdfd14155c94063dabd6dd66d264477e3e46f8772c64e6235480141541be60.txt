import { z } from "zod";
import { teamPushRegistrationSchema } from "./teamPushRegistration.js";

export const teamPushAlertRequestSchema = teamPushRegistrationSchema.pick({
  installationId: true, installationSecret: true, revision: true,
}).extend({
  notificationId: z.string().regex(/^teamChat_[a-f0-9]{64}$/),
  purpose: z.enum(["display", "open"]),
}).strict();
export type TeamPushAlertRequest = z.infer<typeof teamPushAlertRequestSchema>;
