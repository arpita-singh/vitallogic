import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Hash an anon token with SHA-256. We only ever store the hash on the row;
 * the raw token lives in the original browser's storage and travels in
 * server-function inputs.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verify the bearer JWT (if any) and return the verified user id, or null.
 * We never trust client-supplied user ids — they're always re-derived from
 * the token server-side.
 */
async function getVerifiedUserId(): Promise<string | null> {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

/**
 * Verify that the caller is allowed to read/modify a given consult. Returns
 * { ok: true, userId } when authorized via JWT, { ok: true, userId: null }
 * when authorized via matching anon token, or throws "Unauthorized" otherwise.
 */
async function authorizeConsultAccess(
  consultId: string,
  anonToken?: string,
): Promise<{ userId: string | null; ownerUserId: string | null }> {
  const { data: row, error } = await supabaseAdmin
    .from("consults")
    .select("user_id, anon_token_hash")
    .eq("id", consultId)
    .maybeSingle();
  if (error || !row) throw new Error("Consult not found");

  const verifiedUserId = await getVerifiedUserId();

  // Signed-in owner
  if (verifiedUserId && row.user_id === verifiedUserId) {
    return { userId: verifiedUserId, ownerUserId: row.user_id };
  }

  // Anonymous owner with matching token
  if (
    !row.user_id &&
    anonToken &&
    row.anon_token_hash &&
    hashToken(anonToken) === row.anon_token_hash
  ) {
    return { userId: null, ownerUserId: null };
  }

  throw new Error("Unauthorized");
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
  contactEmail?: string;
  contactName?: string;
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
 * Start a consult. For anonymous callers we mint a random per-browser
 * `anonToken` and store its SHA-256 hash on the row. The raw token is
 * returned exactly once — the browser must persist it to talk to this
 * consult later. For signed-in callers, we attribute the consult to the
 * verified user id immediately and skip the token entirely.
 */
export const startConsult = createServerFn({ method: "POST" })
  .inputValidator((data: { intake: Intake; userId?: string | null }) => data)
  .handler(async ({ data }) => {
    const { intake } = data;
    const consultId = crypto.randomUUID();
    const verifiedUserId = await getVerifiedUserId();

    let anonToken: string | undefined;
    let anonTokenHash: string | null = null;
    if (!verifiedUserId) {
      anonToken = randomBytes(32).toString("base64url");
      anonTokenHash = hashToken(anonToken);
    }

    // Use the admin client so we don't need a public RLS path for inserts.
    const { error } = await supabaseAdmin.from("consults").insert({
      id: consultId,
      intake: intake as never,
      user_id: verifiedUserId,
      anon_token_hash: anonTokenHash,
      status: "draft",
    });
    if (error) {
      console.error("startConsult insert failed", error);
      throw new Error("Could not start consult");
    }

    // Seed system message with the intake summary.
    const { error: msgErr } = await supabaseAdmin.from("consult_messages").insert({
      consult_id: consultId,
      role: "system",
      content: intakeSummary(intake),
      anon_token_hash: anonTokenHash,
    });
    if (msgErr) console.error("seed system message failed", msgErr);

    return { consultId, anonToken };
  });

/**
 * Read a consult (intake summary + messages + prescription status snapshot).
 * Replaces direct Supabase reads from the browser, which are no longer
 * permitted by RLS for anonymous consults.
 */
export const getConsult = createServerFn({ method: "POST" })
  .inputValidator((data: { consultId: string; anonToken?: string }) => data)
  .handler(async ({ data }) => {
    const { ownerUserId } = await authorizeConsultAccess(data.consultId, data.anonToken);

    const [{ data: consultRow }, { data: msgs }, { data: rxRows }] = await Promise.all([
      supabaseAdmin
        .from("consults")
        .select("id, intake, user_id, status")
        .eq("id", data.consultId)
        .maybeSingle(),
      supabaseAdmin
        .from("consult_messages")
        .select("role, content, created_at")
        .eq("consult_id", data.consultId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("prescriptions")
        .select("id, status")
        .eq("consult_id", data.consultId),
    ]);

    return {
      consult: consultRow,
      messages: msgs ?? [],
      prescriptions: rxRows ?? [],
      ownerUserId,
    };
  });

/**
 * Save patient contact info onto an existing consult's intake JSON.
 * Requires either signed-in ownership or matching anon token.
 */
export const saveConsultContact = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      consultId: string;
      contactEmail: string;
      contactName?: string;
      anonToken?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await authorizeConsultAccess(data.consultId, data.anonToken);

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("consults")
      .select("intake")
      .eq("id", data.consultId)
      .maybeSingle();
    if (fetchErr || !row) {
      console.error("saveConsultContact fetch failed", fetchErr);
      throw new Error("Could not save contact info");
    }
    const nextIntake = {
      ...((row.intake as Record<string, unknown>) ?? {}),
      contactEmail: data.contactEmail,
      contactName: data.contactName ?? null,
    };
    const { error } = await supabaseAdmin
      .from("consults")
      .update({ intake: nextIntake as never })
      .eq("id", data.consultId);
    if (error) {
      console.error("saveConsultContact update failed", error);
      throw new Error("Could not save contact info");
    }
    return { ok: true };
  });

/**
 * Claim an anonymous consult for the signed-in user. The caller must prove
 * ownership of the anonymous consult by presenting the anon token (or the
 * consult must already have no owner, which is our existing best-effort
 * recovery path for users whose token was lost). We additionally require
 * the verified JWT.
 */
export const claimConsult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { consultId: string; anonToken?: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Prefer token-verified claim — strongest proof of ownership.
    if (data.anonToken) {
      const { data: row } = await supabaseAdmin
        .from("consults")
        .select("anon_token_hash, user_id")
        .eq("id", data.consultId)
        .maybeSingle();
      if (
        row &&
        row.user_id === null &&
        row.anon_token_hash &&
        hashToken(data.anonToken) === row.anon_token_hash
      ) {
        const { error } = await supabaseAdmin
          .from("consults")
          .update({ user_id: userId })
          .eq("id", data.consultId)
          .is("user_id", null);
        if (error) {
          console.error("claimConsult (token) failed", error);
          return { ok: false };
        }
        return { ok: true };
      }
    }

    // Fallback: claim only if the consult is still unowned. RLS already
    // restricts UPDATE to (user_id IS NULL) for the authenticated role.
    const { error } = await supabaseAdmin
      .from("consults")
      .update({ user_id: userId })
      .eq("id", data.consultId)
      .is("user_id", null);
    if (error) {
      console.error("claimConsult (fallback) failed", error);
      return { ok: false };
    }
    return { ok: true };
  });
