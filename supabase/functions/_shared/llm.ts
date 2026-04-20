// Shared LLM provider abstraction for Vital Logic edge functions.
//
// Lets the same edge function code talk to:
//   - Lovable AI Gateway (default — hosted production)
//   - Ollama running locally (self-hosted, OpenAI-compatible)
//   - Anthropic Claude (API key required)
//
// Switched at runtime via the LLM_PROVIDER env var. Default is "lovable" so
// the hosted app keeps working unchanged.
//
//   LLM_PROVIDER=lovable    (default)  → uses LOVABLE_API_KEY
//   LLM_PROVIDER=ollama                → uses OLLAMA_BASE_URL (default http://localhost:11434)
//   LLM_PROVIDER=anthropic             → uses ANTHROPIC_API_KEY

export type Provider = "lovable" | "ollama" | "anthropic";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export function getProvider(): Provider {
  const raw = (Deno.env.get("LLM_PROVIDER") ?? "lovable").toLowerCase();
  if (raw === "ollama" || raw === "anthropic" || raw === "lovable") return raw;
  console.warn(`Unknown LLM_PROVIDER="${raw}", falling back to "lovable"`);
  return "lovable";
}

/**
 * Returns the default model for the current provider unless overridden via
 * LLM_MODEL. Each provider has its own naming scheme.
 */
export function getDefaultModel(provider: Provider): string {
  const override = Deno.env.get("LLM_MODEL");
  if (override) return override;
  switch (provider) {
    case "ollama":
      return "llama3.1";
    case "anthropic":
      return "claude-3-5-sonnet-latest";
    case "lovable":
    default:
      return "google/gemini-3-flash-preview";
  }
}

/**
 * Streaming chat completion. Returns a Response whose body is an
 * OpenAI-compatible Server-Sent Events stream — the existing SSE parser in
 * the consult-chat function works unchanged for Lovable + Ollama, and we
 * normalise Anthropic's native event stream into the same shape.
 */
export async function streamChat(opts: {
  messages: ChatMessage[];
  model?: string;
}): Promise<Response> {
  const provider = getProvider();
  const model = opts.model ?? getDefaultModel(provider);

  if (provider === "anthropic") {
    return streamAnthropic({ messages: opts.messages, model });
  }

  // Lovable + Ollama both speak the OpenAI completions API.
  const url =
    provider === "ollama"
      ? `${Deno.env.get("OLLAMA_BASE_URL") ?? "http://localhost:11434"}/v1/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "lovable") {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    headers.Authorization = `Bearer ${key}`;
  }

  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, stream: true, messages: opts.messages }),
  });
}

/**
 * Non-streaming tool-call completion. Returns the parsed JSON arguments of
 * the first tool call, or null if the model didn't call the tool.
 */
export async function toolCall(opts: {
  messages: ChatMessage[];
  tool: Tool;
  model?: string;
}): Promise<{ ok: true; args: unknown } | { ok: false; status: number; error: string }> {
  const provider = getProvider();
  const model = opts.model ?? getDefaultModel(provider);

  if (provider === "anthropic") {
    return anthropicToolCall({ messages: opts.messages, tool: opts.tool, model });
  }

  const url =
    provider === "ollama"
      ? `${Deno.env.get("OLLAMA_BASE_URL") ?? "http://localhost:11434"}/v1/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "lovable") {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return { ok: false, status: 500, error: "LOVABLE_API_KEY not configured" };
    headers.Authorization = `Bearer ${key}`;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: opts.messages,
      tools: [opts.tool],
      tool_choice: { type: "function", function: { name: opts.tool.function.name } },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error("LLM toolCall failed", provider, resp.status, body);
    return { ok: false, status: resp.status, error: body || "LLM gateway error" };
  }

  const json = await resp.json();
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (typeof args !== "string") {
    return { ok: false, status: 500, error: "No tool call returned" };
  }
  try {
    return { ok: true, args: JSON.parse(args) };
  } catch (e) {
    console.error("Bad tool arguments", e);
    return { ok: false, status: 500, error: "Could not parse tool args" };
  }
}

// ---------- Anthropic helpers ----------

function splitSystem(messages: ChatMessage[]): { system: string; rest: ChatMessage[] } {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  return { system: sys, rest };
}

async function streamAnthropic(opts: { messages: ChatMessage[]; model: string }): Promise<Response> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  const { system, rest } = splitSystem(opts.messages);

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      system,
      stream: true,
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return upstream;
  }

  // Translate Anthropic SSE → OpenAI-compatible SSE so our existing parser
  // (and tee for persistence) needs zero changes.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buf = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json) continue;
            try {
              const evt = JSON.parse(json);
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                const chunk = `data: ${JSON.stringify({
                  choices: [{ delta: { content: evt.delta.text } }],
                })}\n\n`;
                controller.enqueue(encoder.encode(chunk));
              } else if (evt.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              /* partial — ignore */
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function anthropicToolCall(opts: {
  messages: ChatMessage[];
  tool: Tool;
  model: string;
}): Promise<{ ok: true; args: unknown } | { ok: false; status: number; error: string }> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return { ok: false, status: 500, error: "ANTHROPIC_API_KEY not configured" };
  const { system, rest } = splitSystem(opts.messages);

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 4096,
      system,
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
      tools: [
        {
          name: opts.tool.function.name,
          description: opts.tool.function.description,
          input_schema: opts.tool.function.parameters,
        },
      ],
      tool_choice: { type: "tool", name: opts.tool.function.name },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, error: body || "Anthropic error" };
  }

  const json = await resp.json();
  const block = (json.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  if (!block?.input) return { ok: false, status: 500, error: "No tool_use in response" };
  return { ok: true, args: block.input };
}
