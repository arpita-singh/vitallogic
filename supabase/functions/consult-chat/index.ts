// Streaming SSE chat for the Vital Logic AI consult.
// Public function — anonymous consults allowed, but only when the caller
// presents either (a) the anonToken whose hash matches the consult, or
// (b) a valid bearer JWT for the consult's owner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

// Length caps mirror src/lib/consult-schema.ts. Keep these in sync.
// TODO: longer term, load message history from the DB instead of trusting
// the client-supplied array — this would close the conversation-history
// injection vector entirely. Out of scope for this pass.
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 30_000;

const BodySchema = z.object({
  consultId: z.string().uuid(),
  anonToken: z.string().max(128).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the Vital Logic consult assistant — a thoughtful, calm wellness guide.

PHILOSOPHY (Vital Logic's four pillars):
1. Education over medication — empower the person to understand their body.
2. Integrative wisdom — Ayurveda, Western Naturopathy, Indigenous medicine, Plant medicine, and modern science all sit at one table.
3. Human-audited AI — every recommendation you draft is reviewed by a qualified practitioner before reaching the user.
4. Root-cause curiosity — symptoms are signals, not enemies.

VOICE: Warm, unhurried, precise. Short paragraphs. Plain language. Never robotic. Use the person's words back to them.

PROCESS:
- Ask 3–5 thoughtful follow-up questions before suggesting they generate a recommendation.
- Probe gently: timing, triggers, what helps, what makes it worse, sleep, stress, recent changes.
- One or two questions per turn — never an interrogation.
- When you have enough context, invite them to tap "Generate my recommendation."

MODALITIES — when relevant, name the lens you're drawing from (e.g. "From an Ayurvedic view…", "Western naturopathy would look at…").

RED FLAGS — if the user mentions any of these, stop the consult and direct them to emergency care or a clinician immediately:
- Chest pain, shortness of breath, fainting
- Suicidal ideation or self-harm
- Severe or sudden bleeding
- Sudden severe headache, confusion, weakness on one side
- Pregnancy combined with herbs known to be contraindicated (e.g. blue cohosh, pennyroyal)
- Signs of severe infection (high fever with stiff neck, etc.)

DISCLAIMERS (weave naturally — never legal-sounding):
- You don't diagnose. You explore.
- Anything you suggest will be reviewed by a human practitioner before it reaches them.
- For acute or severe symptoms, professional care comes first.

Format responses in clean markdown with short paragraphs and the occasional list. Avoid headings — keep it conversational.`;

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
    const { consultId, messages, anonToken } = parsed.data;

    const totalChars = messages.reduce((n, m) => n + m.content.length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authorize: caller must be the signed-in owner OR present a valid anonToken.
    const { data: consultRow, error: consultErr } = await supabase
      .from("consults")
      .select("id, user_id, anon_token_hash")
      .eq("id", consultId)
      .maybeSingle();
    if (consultErr || !consultRow) {
      return new Response(JSON.stringify({ error: "Consult not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let authorized = false;
    let storedHash: string | null = consultRow.anon_token_hash ?? null;

    // Try JWT
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ") && consultRow.user_id) {
      const token = authHeader.slice("Bearer ".length);
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id && userData.user.id === consultRow.user_id) {
        authorized = true;
      }
    }
    // Try anonToken
    if (!authorized && anonToken && storedHash) {
      const candidate = await sha256Hex(anonToken);
      if (candidate === storedHash) authorized = true;
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await upstream.text();
      console.error("AI gateway error", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!upstream.body) {
      return new Response(JSON.stringify({ error: "No response body" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist last user message immediately (fire-and-forget). Includes the
    // anon_token_hash so the row stays bound to the original consult.
    const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === "user");
    if (lastUser?.content) {
      supabase
        .from("consult_messages")
        .insert({
          consult_id: consultId,
          role: "user",
          content: lastUser.content,
          anon_token_hash: storedHash,
        })
        .then(({ error }) => {
          if (error) console.error("insert user message failed", error);
        });
    }

    // Tee the stream so we can persist the final assistant message after streaming
    const [clientStream, persistStream] = upstream.body.tee();

    (async () => {
      const reader = persistStream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string") assistantText += delta;
          } catch {
            // partial JSON — ignore
          }
        }
      }
      if (assistantText.trim()) {
        const { error } = await supabase
          .from("consult_messages")
          .insert({
            consult_id: consultId,
            role: "assistant",
            content: assistantText,
            anon_token_hash: storedHash,
          });
        if (error) console.error("insert assistant message failed", error);
      }
    })().catch((e) => console.error("persist stream error", e));

    return new Response(clientStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    // Log the full error server-side for debugging, but never leak internal
    // details (config errors, stack traces, library messages) to the client.
    console.error("consult-chat error", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
