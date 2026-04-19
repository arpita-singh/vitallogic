import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { ModalityBadge, type Modality } from "@/components/consult/modality-badge";
import { ContactCapture } from "@/components/consult/contact-capture";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/consult_/$consultId/result")({
  head: () => ({
    meta: [{ title: "Your recommendation — Vital Logic" }],
  }),
  component: ResultPage,
});

type Product = { name: string; form?: string; dosage?: string; notes?: string };
type Recommendation = {
  title: string;
  modality: Modality;
  rationale: string;
  suggested_products: Product[];
  safety_notes: string;
  citations: string[];
};
type RxData = {
  summary: string;
  red_flags: string[];
  escalate: boolean;
  recommendations: Recommendation[];
};
type Rx = {
  id: string;
  status: "pending_review" | "approved" | "rejected" | "escalated";
  draft: RxData;
  final: RxData | null;
  review_notes: string | null;
};

function ResultPage() {
  const { consultId } = Route.useParams();
  const { user } = useAuth();
  const [rx, setRx] = useState<Rx | null>(null);
  const [hasContact, setHasContact] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [rxRes, consultRes] = await Promise.all([
        supabase
          .from("prescriptions")
          .select("id, status, draft, final, review_notes")
          .eq("consult_id", consultId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("consults").select("intake").eq("id", consultId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (rxRes.error) console.error(rxRes.error);
      setRx((rxRes.data as unknown as Rx) ?? null);
      const intake = (consultRes.data?.intake ?? {}) as { contactEmail?: string };
      setHasContact(Boolean(intake.contactEmail));
      setLoading(false);
    };
    void load();

    // Realtime: refresh when this consult's prescription updates (e.g. expert approves).
    const channel = supabase
      .channel(`rx-${consultId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prescriptions", filter: `consult_id=eq.${consultId}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [consultId]);

  if (loading) {
    return (
      <Section>
        <p className="text-center text-muted-foreground">Loading…</p>
      </Section>
    );
  }

  if (!rx) {
    return (
      <Section>
        <SectionHeader title="No recommendation yet" subtitle="Head back to your consult to generate one." />
        <div className="mt-6 text-center">
          <Link
            to="/consult/$consultId"
            params={{ consultId }}
            className="inline-flex rounded-full border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Back to consult
          </Link>
        </div>
      </Section>
    );
  }

  if (rx.status === "rejected") {
    return (
      <Section>
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-surface p-8 text-center">
          <h2 className="font-display text-3xl text-foreground">A practitioner reviewed this carefully.</h2>
          <p className="mt-4 text-muted-foreground">
            Based on what you shared, we'd like you to speak with a clinician in person rather than rely on a digital recommendation.
          </p>
          {rx.review_notes && (
            <p className="mt-4 rounded-xl border border-border bg-background p-4 text-left text-sm text-muted-foreground">
              {rx.review_notes}
            </p>
          )}
          <Link
            to="/"
            className="mt-6 inline-flex rounded-full border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Back home
          </Link>
        </div>
      </Section>
    );
  }

  if (rx.status === "pending_review" || rx.status === "escalated") {
    const escalated = rx.status === "escalated";
    return (
      <Section>
        <div className="mx-auto max-w-xl text-center">
          {/* Pulsing lotus */}
          <div className="relative mx-auto h-24 w-24">
            <div className="absolute inset-0 animate-pulse rounded-full bg-gold/20 blur-2xl" />
            <div
              className={`relative flex h-24 w-24 items-center justify-center rounded-full border ${
                escalated ? "border-destructive/60 bg-destructive/10" : "border-gold/60 bg-gold/10"
              }`}
            >
              {escalated ? (
                <ShieldAlert className="h-10 w-10 text-destructive" />
              ) : (
                <Clock className="h-10 w-10 text-gold" />
              )}
            </div>
          </div>

          <h2 className="mt-6 font-display text-3xl text-foreground md:text-4xl">
            {escalated ? "Flagged for priority review." : "Awaiting human review."}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            {escalated
              ? "Our practitioner team has been notified and will be in touch shortly. If anything feels urgent, please contact your local emergency service."
              : "A qualified practitioner is reviewing your draft recommendation. Most are turned around within a few hours."}
          </p>

          {!user && !hasContact && <ContactCapture consultId={consultId} />}

          {!user && (
            <p className="mx-auto mt-4 max-w-sm text-xs text-muted-foreground">
              Prefer an account?{" "}
              <Link to="/signup" className="text-gold underline-offset-2 hover:underline">
                Create one
              </Link>{" "}
              and your consult is saved automatically.
            </p>
          )}
        </div>
      </Section>
    );
  }

  // approved
  const data = rx.final ?? rx.draft;
  return (
    <Section>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2 text-gold">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-xs uppercase tracking-[0.25em]">Approved by a practitioner</span>
        </div>
        <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">
          Your recommendation
        </h1>
        <p className="mt-4 text-muted-foreground">{data.summary}</p>
        <div className="divider-gold mt-6" />

        <div className="mt-8 space-y-6">
          {data.recommendations.map((r, i) => (
            <article key={i} className="rounded-2xl border border-border bg-surface p-6">
              <ModalityBadge modality={r.modality} />
              <h3 className="mt-3 font-display text-2xl text-foreground">{r.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-foreground/90">{r.rationale}</p>

              {r.suggested_products?.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-xs uppercase tracking-wider text-gold">Suggested</h4>
                  <ul className="mt-2 space-y-3">
                    {r.suggested_products.map((p, j) => (
                      <li key={j} className="rounded-xl border border-border bg-background p-3">
                        <p className="font-medium text-foreground">{p.name}</p>
                        {(p.form || p.dosage) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[p.form, p.dosage].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {p.notes && <p className="mt-1 text-sm text-muted-foreground">{p.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.safety_notes && (
                <div className="mt-5 rounded-xl border border-violet/40 bg-violet/5 p-3 text-sm text-foreground">
                  <p className="text-xs uppercase tracking-wider text-violet">Safety</p>
                  <p className="mt-1">{r.safety_notes}</p>
                </div>
              )}

              {r.citations?.length > 0 && (
                <div className="mt-5">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground">References</h4>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {r.citations.map((c, k) => (
                      <li key={k}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-gold" />
          AI-drafted, human-audited. Vital Logic doesn't diagnose — for any concerning symptom, please see a clinician.
        </p>
      </div>
    </Section>
  );
}
