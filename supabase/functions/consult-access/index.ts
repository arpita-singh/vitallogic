// Unified consult access endpoint.
//
// Replaces the TanStack server-function path that depended on
// SUPABASE_SERVICE_ROLE_KEY in the Worker SSR runtime (which doesn't have it).
// Edge functions run in Deno on Supabase infrastructure where the secret is
// always present.
//
// Actions:
//   read        — fetch consult + messages + prescription summary
//   saveContact — patch contactEmail/contactName onto intake
//   claim       — attribute an anonymous consult to a signed-in user
//   unlock      — flip user_purchases.has_unlocked_education for an approved consult
//
// Auth model:
//   - JWT (Authorization: Bearer …) identifies a signed-in caller. claim/unlock REQUIRE this.
//   - anonToken proves ownership of an anonymous consult (used by read/saveContact/claim).
//
// verify_jwt is disabled in supabase/config.toml — we do auth ourselves so we
// can also accept anonymous (token-bearing) callers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const consultId = z.string().uuid();
const anonToken = z.string().max(128).optional();

const shortText = z.string().trim().max(500);
const longText = z.string().trim().max(2000);

const intakeSchema = z.object({
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

type Intake = z.infer<typeof intakeSchema>;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), consultId, anonToken }),
  z.object({
    action: z.literal("saveContact"),
    consultId,
    anonToken,
    contactEmail: z.string().trim().toLowerCase().email().max(255),
    contactName: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal("claim"), consultId, anonToken }),
  z.object({ action: z.literal("unlock"), consultId }),
  z.object({ action: z.literal("start"), intake: intakeSchema }),
]);

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

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const raw = await req.json().catch(() => null);
    const parsed = Body.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "Invalid request", issues: parsed.error.flatten() }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify the caller's JWT once up front (if any).
    const authHeader = req.headers.get("authorization") ?? "";
    let verifiedUserId: string | null = null;
    let verifiedEmail: string | null = null;
    let isEmailVerified = false;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      const { data } = await admin.auth.getUser(token);
      if (data?.user?.id) {
        verifiedUserId = data.user.id;
        verifiedEmail = data.user.email?.trim().toLowerCase() ?? null;
        isEmailVerified = !!data.user.email_confirmed_at;
      }
    }

    const data = parsed.data;

    // ---- unlock (requires JWT) -------------------------------------------
    if (data.action === "unlock") {
      if (!verifiedUserId) return json({ error: "Unauthorized" }, 401);
      const userId = verifiedUserId;

      const { data: consultRow } = await admin
        .from("consults")
        .select("id, user_id")
        .eq("id", data.consultId)
        .maybeSingle();
      if (!consultRow) return json({ error: "Consult not found" }, 404);
      if (consultRow.user_id !== userId) return json({ error: "Unauthorized" }, 403);

      const { data: rxRow } = await admin
        .from("prescriptions")
        .select("id, status")
        .eq("consult_id", data.consultId)
        .eq("status", "approved")
        .maybeSingle();
      if (!rxRow) return json({ error: "No approved prescription for this consult" }, 400);

      const { data: existing } = await admin
        .from("user_purchases")
        .select("id, has_unlocked_education")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        if (existing.has_unlocked_education) return json({ ok: true });
        const { error } = await admin
          .from("user_purchases")
          .update({ has_unlocked_education: true, consult_id: data.consultId })
          .eq("id", existing.id);
        if (error) {
          console.error("unlock update failed", error);
          return json({ error: "Could not unlock right now" }, 500);
        }
        return json({ ok: true });
      }

      const { error: insErr } = await admin.from("user_purchases").insert({
        user_id: userId,
        consult_id: data.consultId,
        has_unlocked_education: true,
      });
      if (insErr) {
        console.error("unlock insert failed", insErr);
        return json({ error: "Could not unlock right now" }, 500);
      }
      return json({ ok: true });
    }

    // ---- claim (requires JWT) --------------------------------------------
    if (data.action === "claim") {
      if (!verifiedUserId) return json({ error: "Unauthorized" }, 401);
      const userId = verifiedUserId;

      const { data: row } = await admin
        .from("consults")
        .select("anon_token_hash, user_id, intake")
        .eq("id", data.consultId)
        .maybeSingle();
      if (!row) return json({ ok: false, error: "Consult not found" }, 404);
      if (row.user_id) return json({ ok: row.user_id === userId });

      const tokenMatches =
        !!data.anonToken &&
        !!row.anon_token_hash &&
        (await sha256Hex(data.anonToken)) === row.anon_token_hash;

      let emailMatches = false;
      if (!tokenMatches) {
        const intake = (row.intake as Record<string, unknown> | null) ?? null;
        const contactEmail =
          typeof intake?.contactEmail === "string"
            ? (intake.contactEmail as string).trim().toLowerCase()
            : null;
        emailMatches =
          isEmailVerified && !!verifiedEmail && !!contactEmail && verifiedEmail === contactEmail;
      }

      if (!tokenMatches && !emailMatches) {
        return json({ ok: false, error: "Cannot verify ownership" }, 403);
      }

      const { error } = await admin
        .from("consults")
        .update({ user_id: userId })
        .eq("id", data.consultId)
        .is("user_id", null);
      if (error) {
        console.error("claim update failed", error);
        return json({ ok: false, error: "Could not claim consult" }, 500);
      }
      return json({ ok: true });
    }

    // ---- read / saveContact share an authorization step -------------------
    const { data: consultRow } = await admin
      .from("consults")
      .select("id, intake, user_id, status, anon_token_hash")
      .eq("id", data.consultId)
      .maybeSingle();
    if (!consultRow) return json({ error: "Consult not found" }, 404);

    let authorized = false;
    if (verifiedUserId && consultRow.user_id === verifiedUserId) authorized = true;
    if (
      !authorized &&
      !consultRow.user_id &&
      data.anonToken &&
      consultRow.anon_token_hash &&
      (await sha256Hex(data.anonToken)) === consultRow.anon_token_hash
    ) {
      authorized = true;
    }
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    if (data.action === "saveContact") {
      const nextIntake = {
        ...((consultRow.intake as Record<string, unknown>) ?? {}),
        contactEmail: data.contactEmail,
        contactName: data.contactName ?? null,
      };
      const { error } = await admin
        .from("consults")
        .update({ intake: nextIntake })
        .eq("id", data.consultId);
      if (error) {
        console.error("saveContact failed", error);
        return json({ error: "Could not save contact info" }, 500);
      }
      return json({ ok: true });
    }

    // action === "read"
    const [{ data: msgs }, { data: rxRows }] = await Promise.all([
      admin
        .from("consult_messages")
        .select("role, content, created_at")
        .eq("consult_id", data.consultId)
        .order("created_at", { ascending: true }),
      admin
        .from("prescriptions")
        .select("id, status")
        .eq("consult_id", data.consultId),
    ]);

    return json({
      consult: {
        id: consultRow.id,
        intake: consultRow.intake,
        user_id: consultRow.user_id,
        status: consultRow.status,
      },
      messages: msgs ?? [],
      prescriptions: rxRows ?? [],
      ownerUserId: consultRow.user_id,
    });
  } catch (e) {
    console.error("consult-access error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
