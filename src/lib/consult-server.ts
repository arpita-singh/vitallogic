import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Build a Supabase client that respects RLS. If the caller is signed in,
 * forward their bearer token so auth.uid() works inside policies; if not,
 * fall back to the anon role (which our `Consults: anyone can insert`
 * policy allows when user_id is null).
 */
function getSupabaseForRequest() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  }
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization") ?? undefined;
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type Intake = {
  symptoms: string[];
  symptomsNote?: string;
  duration?: "acute" | "subacute" | "chronic";
  severity?: number;
  sleepHours?: number;
  stress?: number;
  diet?: string;
  activity?: number;
  meds?: string;
  allergies?: string;
  pregnancy?: "yes" | "no" | "na";
  under18?: boolean;
  goals: string[];
};

function intakeSummary(intake: Intake): string {
  const parts: string[] = [];
  if (intake.symptoms?.length) parts.push(`Symptoms: ${intake.symptoms.join(", ")}`);
  if (intake.symptomsNote) parts.push(`Notes: ${intake.symptomsNote}`);
  if (intake.duration) parts.push(`Duration: ${intake.duration}`);
  if (intake.severity != null) parts.push(`Severity: ${intake.severity}/10`);
  if (intake.sleepHours != null) parts.push(`Sleep: ${intake.sleepHours}h/night`);
  if (intake.stress != null) parts.push(`Stress: ${intake.stress}/5`);
  if (intake.diet) parts.push(`Diet: ${intake.diet}`);
  if (intake.activity != null) parts.push(`Activity: ${intake.activity}/5`);
  if (intake.meds) parts.push(`Current meds: ${intake.meds}`);
  if (intake.allergies) parts.push(`Allergies: ${intake.allergies}`);
  if (intake.pregnancy && intake.pregnancy !== "na") parts.push(`Pregnant: ${intake.pregnancy}`);
  if (intake.under18) parts.push(`Under 18: yes`);
  if (intake.goals?.length) parts.push(`Goals: ${intake.goals.join(", ")}`);
  return `INTAKE SUMMARY\n${parts.join("\n")}`;
}

/**
 * Start a consult. Works for anonymous (no auth) and authenticated users.
 * We use the admin client and explicitly set user_id from the optional auth header.
 */
export const startConsult = createServerFn({ method: "POST" })
  .inputValidator((data: { intake: Intake; userId?: string | null }) => data)
  .handler(async ({ data }) => {
    const { intake, userId } = data;
    const supabase = getSupabaseForRequest();

    const { data: consult, error } = await supabase
      .from("consults")
      .insert({ intake: intake as never, user_id: userId ?? null, status: "draft" })
      .select("id")
      .maybeSingle();

    if (error || !consult) {
      console.error("startConsult insert failed", error);
      throw new Error("Could not start consult");
    }

    // Seed a system message with the intake summary so the AI has context.
    const { error: msgErr } = await supabase.from("consult_messages").insert({
      consult_id: consult.id,
      role: "system",
      content: intakeSummary(intake),
    });
    if (msgErr) console.error("seed system message failed", msgErr);

    return { consultId: consult.id as string };
  });

/**
 * Claim an anonymous consult for the signed-in user.
 */
export const claimConsult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { consultId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("consults")
      .update({ user_id: userId })
      .eq("id", data.consultId)
      .is("user_id", null);
    if (error) {
      console.error("claimConsult failed", error);
      return { ok: false };
    }
    return { ok: true };
  });
