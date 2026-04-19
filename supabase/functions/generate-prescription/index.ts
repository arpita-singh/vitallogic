// Generate a draft prescription for a consult using tool-calling.
// Public function — works for anonymous and authenticated consults.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

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

You will receive a consult's intake and full conversation. Produce ONE call to the submit_prescription function with 1–2 thoughtful recommendations.

GROUNDING:
- Draw from the four traditions: Ayurveda, Western Naturopathy, Indigenous medicine, Plant medicine. Pick the modality that best fits the case; "lifestyle" is also valid.
- Be conservative. Prefer education and gentle interventions.
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const userPayload = `INTAKE:\n${JSON.stringify(clippedIntake, null, 2)}\n\nCONVERSATION:\n${conversation}\n\nDraft the prescription now using the submit_prescription tool.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPayload },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_prescription" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call returned", JSON.stringify(aiJson));
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
    };
    try {
      draft = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Bad tool arguments", e);
      return new Response(JSON.stringify({ error: "Could not parse draft" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    console.error("generate-prescription error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
