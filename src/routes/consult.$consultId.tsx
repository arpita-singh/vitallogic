import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Send, Sparkles } from "lucide-react";
import { Section } from "@/components/section";
import { ChatMessage } from "@/components/consult/chat-message";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/consult/$consultId")({
  head: () => ({
    meta: [{ title: "Your consult — Vital Logic" }],
  }),
  component: ConsultChatPage,
});

type Msg = { role: "user" | "assistant" | "system"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consult-chat`;

function ConsultChatPage() {
  const { consultId } = Route.useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [intakeSummary, setIntakeSummary] = useState<string>("");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("consult_messages")
        .select("role, content")
        .eq("consult_id", consultId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("Could not load your consult.");
        return;
      }
      const all = (data ?? []) as Msg[];
      const sys = all.find((m) => m.role === "system");
      if (sys) setIntakeSummary(sys.content);
      setMessages(all.filter((m) => m.role !== "system"));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [consultId]);

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Send first AI turn automatically once loaded with no assistant messages yet
  useEffect(() => {
    if (!loaded || streaming) return;
    const hasAssistant = messages.some((m) => m.role === "assistant");
    const hasUser = messages.some((m) => m.role === "user");
    if (!hasAssistant && !hasUser && intakeSummary) {
      // Prime with an opening question grounded in the intake
      void send("Hello — I just finished the intake. Could you take a look and ask me your first question?", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, intakeSummary]);

  const send = async (text: string, hidden = false) => {
    if (!text.trim() || streaming) return;
    setStreaming(true);
    const newUser: Msg = { role: "user", content: text };
    const next = hidden ? messages : [...messages, newUser];
    if (!hidden) setMessages(next);
    setInput("");

    // Build payload (include intake summary as system context)
    const payloadMessages: Msg[] = [];
    if (intakeSummary) payloadMessages.push({ role: "system", content: intakeSummary });
    payloadMessages.push(...next);
    if (hidden) payloadMessages.push(newUser);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ consultId, messages: payloadMessages }),
      });

      if (!resp.ok) {
        if (resp.status === 429) toast.error("Slow down — try again in a moment.");
        else if (resp.status === 402) toast.error("AI credits exhausted — please add credits.");
        else toast.error("Couldn't reach the AI. Please try again.");
        setStreaming(false);
        return;
      }
      if (!resp.body) {
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string") upsertAssistant(delta);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection error. Please try again.");
    } finally {
      setStreaming(false);
    }
  };

  const generateRx = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-prescription", {
        body: { consultId },
      });
      if (error) throw error;
      if (!data?.prescriptionId) throw new Error("No prescription returned");
      navigate({ to: "/consult/$consultId/result", params: { consultId } });
    } catch (e) {
      console.error(e);
      toast.error("Could not generate your recommendation. Try again in a moment.");
      setGenerating(false);
    }
  };

  const userTurns = messages.filter((m) => m.role === "user").length;
  const canGenerate = userTurns >= 3 && !streaming && !generating;

  return (
    <Section className="!py-6 md:!py-10">
      <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-2xl flex-col">
        {/* Status banner */}
        <div className="mb-3 rounded-2xl border border-gold/40 bg-gold/5 px-4 py-3 text-xs text-foreground">
          <span className="text-gold">Consult started.</span>{" "}
          <span className="text-muted-foreground">
            Chat with your AI guide for a few exchanges, then tap{" "}
            <span className="text-foreground">Generate my recommendation</span> to send it for
            human review.
          </span>
        </div>
        {/* Intake summary */}
        {intakeSummary && (
          <div className="mb-3 rounded-2xl border border-border bg-surface">
            <button
              onClick={() => setIntakeOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
            >
              <span className="text-muted-foreground">
                <span className="text-gold">Intake</span> summary
              </span>
              {intakeOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {intakeOpen && (
              <pre className="border-t border-border whitespace-pre-wrap px-4 py-3 text-xs text-muted-foreground">
                {intakeSummary}
              </pre>
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 && !streaming && (
            <p className="text-center text-sm text-muted-foreground">
              Loading your consult…
            </p>
          )}
          {messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} content={m.content} />
          ))}
        </div>

        {/* Generate CTA */}
        {canGenerate && (
          <div className="mt-3 rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-3">
            <button
              onClick={generateRx}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              <Sparkles className="h-4 w-4" />
              Generate my recommendation
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              A human practitioner will review before it reaches you.
            </p>
          </div>
        )}

        {/* Composer */}
        <div className="mt-3 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={streaming ? "…" : "Type your reply"}
              rows={1}
              disabled={streaming}
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Vital Logic doesn't diagnose. For emergencies, call your local emergency line.{" "}
            <Link to="/integrity" className="text-gold underline-offset-2 hover:underline">
              Why
            </Link>
          </p>
        </div>
      </div>
    </Section>
  );
}
