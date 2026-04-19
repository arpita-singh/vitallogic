// Shared zod schemas for consult inputs. Server-only (do not import in client
// components — the validators throw raw zod errors that aren't user-friendly).
//
// NOTE: edge functions cannot import from src/, so the equivalent caps are
// hand-mirrored in supabase/functions/consult-chat/index.ts and
// supabase/functions/generate-prescription/index.ts. Keep them in sync.
import { z } from "zod";

const shortText = z.string().trim().max(500);
const longText = z.string().trim().max(2000);

export const intakeSchema = z.object({
  symptoms: z.array(z.string().max(100)).max(20).default([]),
  symptomsNote: longText.optional(),
  duration: z.enum(["acute", "subacute", "chronic"]).optional(),
  severity: z.number().int().min(0).max(10).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  stress: z.number().int().min(0).max(5).optional(),
  diet: shortText.optional(),
  activity: z.number().int().min(0).max(5).optional(),
  meds: longText.optional(),
  allergies: longText.optional(),
  pregnancy: z.enum(["yes", "no", "na"]).optional(),
  under18: z.boolean().optional(),
  goals: z.array(z.string().max(100)).max(20).default([]),
  contactEmail: z.string().trim().toLowerCase().email().max(255).optional(),
  contactName: shortText.optional(),
});

export const consultIdSchema = z.string().uuid();
export const anonTokenSchema = z.string().max(128).optional();

export const startConsultInput = z.object({
  intake: intakeSchema,
  userId: z.string().nullish(),
});

export const getConsultInput = z.object({
  consultId: consultIdSchema,
  anonToken: anonTokenSchema,
});

export const saveConsultContactInput = z.object({
  consultId: consultIdSchema,
  contactEmail: z.string().trim().toLowerCase().email().max(255),
  contactName: z.string().trim().max(500).optional(),
  anonToken: anonTokenSchema,
});

export const claimConsultInput = z.object({
  consultId: consultIdSchema,
  anonToken: anonTokenSchema,
});

export const unlockEducationInput = z.object({
  consultId: consultIdSchema,
});
