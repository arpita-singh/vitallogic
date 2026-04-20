import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, User, Sparkles } from "lucide-react";
import { Section } from "@/components/section";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_expert/expert_/consult/$consultId")({
  head: () => ({
    meta: [{ title: "Draft consult — Vital Logic" }],
  }),
  component: ExpertDraftConsult,
});

type ConsultRow = {
  id: string;
  status: string;
  created_at: string;
  intake: Record<string, unknown> | null;
};

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

function ExpertDraftConsult() {
  const { consultId } = Route.useParams();
  const navigate = useNavigate();
  const [consult, setConsult] = useState<ConsultRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: c }, { data: msgs }, { data: rx }] = await Promise.all([
        supabase
          .from("consults")
          .select("id, status, created_at, intake")
          .eq("id", consultId)
          .maybeSingle(),
        supabase
          .from("consult_messages")
          .select("role, content, created_at")
          .eq("consult_id", consultId)
          .order("created_at", { ascending: true }),
        supabase
          .from("prescriptions")
          .select("id")
          .eq("consult_id", consultId)
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      // If a prescription already exists, jump straight to the standard review.
      if (rx?.id) {
        navigate({ to: "/expert/$prescriptionId", params: { prescriptionId: rx.id } });
        return;
      }

      setConsult((c as ConsultRow) ?? null);
      setMessages((msgs ?? []) as Message[]);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [consultId, navigate]);

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-prescription", {
        body: { consultId },
      });
      if (error) throw error;
      const prescriptionId = (data as { prescriptionId?: string })?.prescriptionId;
      if (!prescriptionId) throw new Error("No prescription returned");
      toast.success("Draft generated");
      navigate({ to: "/expert/$prescriptionId", params: { prescriptionId } });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not generate draft");
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Section className="py-16">
        <p className="text-center text-sm text-muted-foreground">Loading consult…</p>
      </Section>
    );
  }

  if (!consult) {
    return (
      <Section className="py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">Consult not found.</p>
          <Link
            to="/expert"
            search={{ filter: "drafts" }}
            className="mt-4 inline-flex items-center gap-2 text-sm text-gold hover:opacity-80"
          >
            <ArrowLeft className="h-4 w-4" /> Back to queue
          </Link>
        </div>
      </Section>
    );
  }

  const intake = consult.intake ?? {};
  const symptoms = (intake.symptoms as string[] | undefined) ?? [];
  const goals = (intake.goals as string[] | undefined) ?? [];
  const contactName = (intake.contactName as string | undefined) ?? null;
  const contactEmail = (intake.contactEmail as string | undefined) ?? null;

  return (
    <Section className="py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/expert"
          search={{ filter: "drafts" }}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </Link>

        <div className="mt-6 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl text-foreground md:text-4xl">
            In-progress <span className="text-gradient-gold">consult</span>
          </h1>
          <span className="font-mono text-xs text-muted-foreground">
            #{consult.id.slice(0, 8)}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Started{" "}
          {new Date(consult.created_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>

        {/* Contact */}
        <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Contact</h2>
          {contactName || contactEmail ? (
            <div className="mt-2 space-y-1.5">
              {contactName && (
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {contactName}
                </p>
              )}
              {contactEmail && (
                <a
                  href={`mailto:${contactEmail}`}
                  className="flex items-center gap-2 text-sm text-gold hover:opacity-80"
                >
                  <Mail className="h-4 w-4" />
                  {contactEmail}
                </a>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Patient hasn't provided contact details yet.
            </p>
          )}
        </div>

        {/* Intake summary */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Intake</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            {symptoms.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Symptoms</dt>
                <dd className="mt-1 text-foreground">{symptoms.join(" · ")}</dd>
              </div>
            )}
            {goals.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Goals</dt>
                <dd className="mt-1 text-foreground">{goals.join(" · ")}</dd>
              </div>
            )}
            {(intake.duration as string | undefined) && (
              <Field label="Duration" value={intake.duration as string} />
            )}
            {intake.severity != null && (
              <Field label="Severity" value={`${intake.severity}/10`} />
            )}
            {intake.sleepHours != null && (
              <Field label="Sleep" value={`${intake.sleepHours}h/night`} />
            )}
            {intake.stress != null && <Field label="Stress" value={`${intake.stress}/5`} />}
            {(intake.diet as string | undefined) && (
              <Field label="Diet" value={intake.diet as string} />
            )}
            {intake.activity != null && (
              <Field label="Activity" value={`${intake.activity}/5`} />
            )}
            {(intake.meds as string | undefined) && (
              <Field label="Current meds" value={intake.meds as string} wide />
            )}
            {(intake.allergies as string | undefined) && (
              <Field label="Allergies" value={intake.allergies as string} wide />
            )}
            {intake.pregnancy && intake.pregnancy !== "na" ? (
              <Field label="Pregnant" value={String(intake.pregnancy)} />
            ) : null}
            {intake.under18 === true && <Field label="Under 18" value="yes" />}
            {(intake.symptomsNote as string | undefined) && (
              <Field label="Notes" value={intake.symptomsNote as string} wide />
            )}
          </dl>
        </div>

        {/* Conversation */}
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Conversation</h2>
          {messages.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No chat messages yet — patient hasn't engaged the consult chat.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {messages.map((m, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-border bg-background p-3 text-sm"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.role}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{m.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action */}
        <div className="mt-8 rounded-2xl border border-gold/40 bg-gold/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg text-foreground">Push to draft prescription</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Generates an AI draft from the intake + chat so you can review it.
              </p>
            </div>
            <button
              onClick={onGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium uppercase tracking-wider text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {generating ? "Generating…" : "Generate prescription"}
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}
