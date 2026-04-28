// Shared LLM provider abstraction for Vital Logic.
// Full version: Embeddings, Streaming Chat, and Tool Calls.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string; };

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

/**
 * Generates an embedding vector for RAG using your local Ollama.
 */
export async function embed(text: string): Promise<number[]> {
  const baseUrl = Deno.env.get("OLLAMA_BASE_URL") ?? "http://host.docker.internal:11434";
  try {
    const resp = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "mxbai-embed-large:latest", input: text }),
    });
    if (!resp.ok) throw new Error(`Ollama Error: ${resp.status}`);
    const json = await resp.json();
    return json.embeddings[0];
  } catch (e) {
    console.error("❌ Embedding Failed:", e.message);
    return new Array(1024).fill(0); 
  }
}

/**
 * Direct Gemini 3 Flash Stream
 */
export async function streamChat(opts: { messages: ChatMessage[] }): Promise<Response> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return new Response("Missing API Key", { status: 500 });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${apiKey}`;
  const contents = opts.messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.2 } }),
  });

  if (!response.ok) return response;

  const reader = response.body!.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new Response(new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
              }
            } catch (e) { /* ignore partial */ }
          }
        }
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    }
  }), { headers: { "Content-Type": "text/event-stream" } });
}

/**
 * Restored ToolCall for Prescription Generation.
 * Asks Gemini to output structured JSON for the prescription tool.
 */
export async function toolCall(opts: {
  messages: ChatMessage[];
  tool: Tool;
}): Promise<{ ok: true; args: unknown } | { ok: false; status: number; error: string }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { ok: false, status: 500, error: "Missing API Key" };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
  
  // Instruct Gemini to behave like a JSON tool-caller
  const systemPrompt = `You are a structured data extractor. Return ONLY a valid JSON object matching this schema: ${JSON.stringify(opts.tool.function.parameters)}. No prose, no markdown blocks.`;
  
  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    ...opts.messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }))
  ];

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, generationConfig: { response_mime_type: "application/json" } }),
    });

    if (!resp.ok) return { ok: false, status: resp.status, error: "Gemini Tool Call Failed" };
    
    const json = await resp.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return { ok: true, args: JSON.parse(rawText) };
  } catch (e) {
    return { ok: false, status: 500, error: e.message };
  }
}