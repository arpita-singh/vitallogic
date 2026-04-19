import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

    const { data: consult, error } = await supabaseAdmin
      .from("consults")
      .insert({ intake: intake as never, user_id: userId ?? null, status: "draft" })
      .select("id")
      .maybeSingle();

    if (error || !consult) {
      console.error("startConsult insert failed", error);
      throw new Error("Could not start consult");
    }

    // Seed a system message with the intake summary so the AI has context.
    const { error: msgErr } = await supabaseAdmin.from("consult_messages").insert({
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
