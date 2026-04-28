// Generate a draft prescription for a consult using tool-calling.
// Public function — works for anonymous and authenticated consults.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { toolCall } from "../_shared/llm.ts";

// Hard caps to bound prompt size before it hits the AI gateway.
const MAX_INTAKE_FIELD_CHARS = 2000;
const MAX_PROMPT_CHARS = 30_000;

const BodySchema = z.object({
  consultId: z.string().uuid(),
  anonToken: z.string().max(128).optional(),
});

function clip(value: unknown, max: number): unknown {
  if (typeof value === "string") return value.length > max ? value.slice(0, max) + "…[truncated]" : value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => clip(v, max));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = clip(v, max);
    }
    return out;
  }
  return value;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the Vital Logic prescription drafting assistant.

You will receive a consult's intake, full conversation, AND a SAFE_CATALOG of products that have already been filtered for this patient's known contraindications. Produce ONE call to the submit_prescription function with 1–2 thoughtful recommendations.

GROUNDING:
- Draw from the four traditions: Ayurveda, Western Naturopathy, Indigenous medicine, Plant medicine. Pick the modality that best fits the case; "lifestyle" is also valid.
- Be conservative. Prefer education and gentle interventions.
- When you suggest a named product, prefer one from SAFE_CATALOG. Anything you suggest outside SAFE_CATALOG must still respect the EXCLUDED_PRODUCTS list — never recommend an excluded product or its close substitutes.
- Cite credible sources where you can (textbook chapters, peer-reviewed studies, traditional pharmacopoeias).

RED FLAGS — set escalate=true and list the red_flags if you detect any of:
- Chest pain, severe shortness of breath, fainting
- Suicidal ideation or self-harm
- Severe/sudden bleeding
- Sudden severe headache, confusion, one-sided weakness
- Pregnancy + contraindicated herbs
- Signs of severe infection
When escalating, the recommendations array should still contain a single entry advising professional/emergency care.

EVERY recommendation must include: title, modality, rationale, suggested_products (may be empty for lifestyle), safety_notes, citations.

A human practitioner will review your draft before it is shown to the user. Be honest about uncertainty.`;

const tool = {
  type: "function",
  function: {
    name: "submit_prescription",
    description: "Submit the draft Vital Logic prescription.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "1-2 sentence summary of the recommendation." },
        red_flags: { type: "array", items: { type: "string" } },
        escalate: { type: "boolean" },
        recommendations: {
          type: "array",
          minItems: 1,
          maxItems: 2,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              modality: {
                type: "string",
                enum: [
                  "ayurveda",
                  "western_naturopathy",
                  "indigenous",
                  "plant_medicine",
                  "lifestyle",
                ],
              },
              rationale: { type: "string" },
              suggested_products: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    form: { type: "string" },
                    dosage: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["name"],
                  additionalProperties: false,
                },
              },
              safety_notes: { type: "string" },
              citations: { type: "array", items: { type: "string" } },
            },
            required: [
              "title",
              "modality",
              "rationale",
              "suggested_products",
              "safety_notes",
              "citations",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "red_flags", "escalate", "recommendations"],
      additionalProperties: false,
    },
  },
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", issues: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { consultId, anonToken } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull intake + history
    const { data: consult, error: cErr } = await supabase
      .from("consults")
      .select("id, intake, user_id, anon_token_hash")
      .eq("id", consultId)
      .maybeSingle();
    if (cErr || !consult) {
      return new Response(JSON.stringify({ error: "Consult not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize: signed-in owner OR matching anonToken.
    let authorized = false;
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ") && consult.user_id) {
      const token = authHeader.slice("Bearer ".length);
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id && userData.user.id === consult.user_id) {
        authorized = true;
      }
    }
    if (!authorized && anonToken && consult.anon_token_hash) {
      const candidate = await sha256Hex(anonToken);
      if (candidate === consult.anon_token_hash) authorized = true;
    }
    // Allow staff (experts/admins) to draft on behalf of the patient.
    if (!authorized && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (uid) {
        const [{ data: isExpert }, { data: isAdmin }] = await Promise.all([
          supabase.rpc("has_role", { _user_id: uid, _role: "expert" }),
          supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
        ]);
        if (isExpert === true || isAdmin === true) authorized = true;
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Provider key checks happen inside `_shared/llm.ts` after authorization,
    // so unauthenticated callers still get a 401 rather than leaking config state.

    // Idempotency: if an approved prescription already exists for this consult,
    // return it instead of stacking another pending draft. This prevents the
    // "patient is bounced into a new chat loop" bug.
    const { data: existingApproved } = await supabase
      .from("prescriptions")
      .select("id, status")
      .eq("consult_id", consultId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingApproved) {
      return new Response(
        JSON.stringify({ prescriptionId: existingApproved.id, status: existingApproved.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Also short-circuit if there's already a pending draft awaiting review —
    // patients shouldn't be able to silently spawn duplicates.
    const { data: existingPending } = await supabase
      .from("prescriptions")
      .select("id, status")
      .eq("consult_id", consultId)
      .in("status", ["pending_review", "escalated"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingPending) {
      return new Response(
        JSON.stringify({ prescriptionId: existingPending.id, status: existingPending.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: msgs } = await supabase
      .from("consult_messages")
      .select("role, content, created_at")
      .eq("consult_id", consultId)
      .order("created_at", { ascending: true });

    // ---- Safety guardrails: filter the certified catalog before prompting ----
    type Guardrails = {
      contraindications?: string[];
      drug_interactions?: string[];
      pregnancy_unsafe?: boolean;
      breastfeeding_unsafe?: boolean;
      hyperthyroid_unsafe?: boolean;
      autoimmune_unsafe?: boolean;
      under18_unsafe?: boolean;
      notes?: string;
    };
    type CatalogRow = {
      id: string;
      product_name: string;
      category: string;
      vendor_name: string | null;
      aust_l_number: string | null;
      safety_guardrails: Guardrails | null;
    };

    const intake = (consult.intake ?? {}) as Record<string, unknown>;
    const intakeStr = JSON.stringify(intake).toLowerCase();
    const isPregnant = (intake.pregnancy as string | undefined) === "yes";
    const isUnder18 = intake.under18 === true;
    const hasHyperthyroid =
      /hyperthyroid|thyrotox|graves/i.test(intakeStr);
    const hasAutoimmune =
      /autoimmune|lupus|rheumatoid|hashimoto|ms\b|multiple sclerosis|crohn/i.test(intakeStr);
    const medsLower = String(intake.meds ?? "").toLowerCase();

    const { data: catalogRaw, error: catalogErr } = await supabase
      .from("certified_materia_medica")
      .select("id, product_name, category, vendor_name, aust_l_number, safety_guardrails")
      .eq("stock_status", true)
      .eq("import_status", "live");
    if (catalogErr) console.error("catalog fetch error", catalogErr);
    const catalog = (catalogRaw ?? []) as CatalogRow[];

    type FilteredItem = CatalogRow & { excluded_reason?: string };
    const safeCatalog: FilteredItem[] = [];
    const excludedCatalog: FilteredItem[] = [];
    for (const item of catalog) {
      const g = item.safety_guardrails ?? {};
      const reasons: string[] = [];
      if (isPregnant && g.pregnancy_unsafe) reasons.push("pregnancy");
      if (isUnder18 && g.under18_unsafe) reasons.push("under 18");
      if (hasHyperthyroid && g.hyperthyroid_unsafe) reasons.push("hyperthyroidism");
      if (hasAutoimmune && g.autoimmune_unsafe) reasons.push("autoimmune condition");
      // Drug interaction match: any token from drug_interactions appears in
      // the patient's `meds` free-text field.
      if (Array.isArray(g.drug_interactions) && medsLower) {
        for (const interaction of g.drug_interactions) {
          if (typeof interaction === "string" && interaction.trim()) {
            if (medsLower.includes(interaction.toLowerCase())) {
              reasons.push(`interaction with ${interaction}`);
              break;
            }
          }
        }
      }
      if (reasons.length > 0) {
        excludedCatalog.push({ ...item, excluded_reason: reasons.join(", ") });
      } else {
        safeCatalog.push(item);
      }
    }

    // Truncate intake free-text fields and clip the joined conversation to a
    // hard char cap so a runaway-long history can't blow up the AI prompt.
    const clippedIntake = clip(consult.intake, MAX_INTAKE_FIELD_CHARS);
    let conversation = (msgs ?? [])
      .map((m) => `${m.role.toUpperCase()}: ${(m.content ?? "").slice(0, MAX_INTAKE_FIELD_CHARS)}`)
      .join("\n\n");
    if (conversation.length > MAX_PROMPT_CHARS) {
      // Keep the tail — most recent context matters most for drafting.
      conversation = "…[earlier messages truncated]\n\n" + conversation.slice(-MAX_PROMPT_CHARS);
    }

    const safeListForPrompt = safeCatalog.slice(0, 60).map((p) => ({
      name: p.product_name,
      category: p.category,
      vendor: p.vendor_name ?? undefined,
    }));
    const excludedListForPrompt = excludedCatalog.slice(0, 30).map((p) => ({
      name: p.product_name,
      category: p.category,
      reason: p.excluded_reason,
    }));

    const userPayload =
      `INTAKE:\n${JSON.stringify(clippedIntake, null, 2)}\n\n` +
      `SAFE_CATALOG (prefer these):\n${JSON.stringify(safeListForPrompt, null, 2)}\n\n` +
      `EXCLUDED_PRODUCTS (DO NOT recommend or suggest substitutes for safety reasons):\n${JSON.stringify(excludedListForPrompt, null, 2)}\n\n` +
      `CONVERSATION:\n${conversation}\n\n` +
      `Draft the prescription now using the submit_prescription tool.`;

    const aiResult = await toolCall({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
      tool: tool as Parameters<typeof toolCall>[0]["tool"],
    });

    if (!aiResult.ok) {
      if (aiResult.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResult.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("AI provider error", aiResult.status, aiResult.error);
      return new Response(JSON.stringify({ error: "Could not draft prescription" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let draft: {
      recommendations: unknown[];
      red_flags: string[];
      escalate: boolean;
      summary: string;
      safety_filtered?: {
        applied_flags: string[];
        excluded_products: { name: string; reason: string }[];
      };
    };
    try {
      draft = aiResult.args as typeof draft;
    } catch (e) {
      console.error("Bad tool arguments", e);
      return new Response(JSON.stringify({ error: "Could not parse draft" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit: attach the guardrails decision so reviewers (and the result page)
    // can see what was filtered and why. This is part of the draft so it
    // travels with the prescription through review.
    const appliedFlags: string[] = [];
    if (isPregnant) appliedFlags.push("pregnancy");
    if (isUnder18) appliedFlags.push("under 18");
    if (hasHyperthyroid) appliedFlags.push("hyperthyroidism");
    if (hasAutoimmune) appliedFlags.push("autoimmune");
    if (medsLower.trim()) appliedFlags.push("current medications");
    draft.safety_filtered = {
      applied_flags: appliedFlags,
      excluded_products: excludedCatalog.slice(0, 50).map((p) => ({
        name: p.product_name,
        reason: p.excluded_reason ?? "",
      })),
    };

    const status =
      draft.escalate || (Array.isArray(draft.red_flags) && draft.red_flags.length > 0)
        ? "escalated"
        : "pending_review";

    const { data: rx, error: rxErr } = await supabase
      .from("prescriptions")
      .insert({ consult_id: consultId, draft, status })
      .select("id, status")
      .maybeSingle();

    if (rxErr || !rx) {
      console.error("insert prescription failed", rxErr);
      return new Response(JSON.stringify({ error: "Could not save draft" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("consults").update({ status }).eq("id", consultId);

    return new Response(JSON.stringify({ prescriptionId: rx.id, status: rx.status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Log the full error server-side for debugging, but never leak internal
    // details (config errors, stack traces, library messages) to the client.
    console.error("generate-prescription error", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
