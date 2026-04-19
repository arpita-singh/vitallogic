import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Clock, ShieldAlert, CheckCircle2, BookOpen, Compass, Heart, Sun, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Section, SectionHeader } from "@/components/section";
import { ModalityBadge, type Modality } from "@/components/consult/modality-badge";
import { ContactCapture } from "@/components/consult/contact-capture";
import { ProductCard } from "@/components/consult/product-card";
import type { AttachedProduct } from "@/components/expert/product-picker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { rememberPendingConsult } from "@/lib/claim-consult";

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
  attached_products: AttachedProduct[];
};

function ResultPage() {
  const { consultId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rx, setRx] = useState<Rx | null>(null);
  const [hasContact, setHasContact] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [consultOwnerId, setConsultOwnerId] = useState<string | null | undefined>(undefined);
  const [intakeEmail, setIntakeEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [rxRes, consultRes, unlockRes] = await Promise.all([
        supabase
          .from("prescriptions")
          .select("id, status, draft, final, review_notes, attached_products")
          .eq("consult_id", consultId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("consults").select("intake, user_id").eq("id", consultId).maybeSingle(),
        user
          ? supabase
              .from("user_purchases")
              .select("has_unlocked_education")
              .eq("user_id", user.id)
              .eq("has_unlocked_education", true)
              .limit(1)
          : Promise.resolve({ data: [] as { has_unlocked_education: boolean }[] }),
      ]);
      if (cancelled) return;
      if (rxRes.error) console.error(rxRes.error);
      setRx((rxRes.data as unknown as Rx) ?? null);
      const consultRow = consultRes.data as { intake?: { contactEmail?: string }; user_id?: string | null } | null;
      const intake = (consultRow?.intake ?? {}) as { contactEmail?: string };
      setHasContact(Boolean(intake.contactEmail));
      setIntakeEmail(intake.contactEmail);
      setConsultOwnerId(consultRow?.user_id ?? null);
      setUnlocked((unlockRes.data?.length ?? 0) > 0);
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
  }, [consultId, user]);

  const handleUnlock = async () => {
    if (!user) {
      toast.info("Please sign in to unlock your Owner's Manual.");
      void navigate({ to: "/login", search: { redirect: `/consult/${consultId}/result` } });
      return;
    }
    setUnlocking(true);
    const { error } = await supabase.from("user_purchases").insert({
      user_id: user.id,
      consult_id: consultId,
      has_unlocked_education: true,
    });
    if (error) {
      console.error(error);
      toast.error("Could not unlock right now. Please try again.");
      setUnlocking(false);
      return;
    }
    toast.success("Unlocked. Welcome to your Owner's Manual.");
    void navigate({ to: "/owner-manual" });
  };

  if (loading) {
    return (
      <Section>
        <p className="text-center text-muted-foreground">Loading…</p>
      </Section>
    );
  }

  // Gate: anonymous consult OR signed-in user who doesn't own this consult
  // → show sign-in / sign-up prompt instead of the prescription.
  const isOwner = user && consultOwnerId && user.id === consultOwnerId;
  const needsAuth = !isOwner;
  if (needsAuth) {
    rememberPendingConsult(consultId);
    const redirectPath = `/consult/${consultId}/result`;
    return (
      <Section>
        <div className="mx-auto max-w-xl rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/10 via-background to-violet/10 p-8 text-center md:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
            <LogIn className="h-7 w-7 text-gold" />
          </div>
          <h1 className="mt-5 font-display text-3xl text-foreground md:text-4xl">
            Sign in to view your prescription
          </h1>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Your practitioner is reviewing your consult. Sign in or create an account
            {intakeEmail ? <> with <span className="text-foreground">{intakeEmail}</span></> : null}
            {" "}to securely receive your recommendation.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/login"
              search={{ redirect: redirectPath }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
            <Link
              to="/signup"
              search={{ redirect: redirectPath, email: intakeEmail }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gold/60 bg-transparent px-6 py-3 text-sm font-medium text-foreground hover:bg-gold/10"
            >
              <UserPlus className="h-4 w-4" /> Create account
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Email, Google, or Apple — choose what's easiest.
          </p>
        </div>
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
  const products = (rx.attached_products ?? []) as AttachedProduct[];
  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-gold">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-xs uppercase tracking-[0.25em]">Approved by a practitioner</span>
        </div>
        <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">
          Your recommendation
        </h1>
        <p className="mt-4 text-muted-foreground">{data.summary}</p>
        <div className="divider-gold mt-6" />

        {/* Section 1: Medication cards */}
        {products.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl text-foreground">Your prescribed support</h2>
              <span className="text-xs uppercase tracking-wider text-gold">
                {products.length} {products.length === 1 ? "item" : "items"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Certified products selected by your practitioner from our materia medica catalogue.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {products.map((p) => (
                <ProductCard key={p.product_id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Recommendations narrative */}
        <div className="mt-10 space-y-6">
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

        {/* Section 2: Owner's Manual unlock */}
        <section className="mt-12 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/10 via-background to-violet/10 p-8 md:p-10">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-gold" />
            <span className="text-xs uppercase tracking-[0.25em] text-gold">Premium</span>
          </div>
          <h2 className="mt-4 font-display text-3xl text-foreground md:text-4xl">
            Unlock your <span className="text-gradient-gold">Owner's Manual</span>
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            A custom preventative-care guide built from your consult — your unique constitution,
            mind-body patterns, and the daily habits that keep you in flow.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            <ManualBullet icon={<Compass className="h-4 w-4 text-gold" />} text="Your unique design" />
            <ManualBullet icon={<Heart className="h-4 w-4 text-gold" />} text="Mind-body connection" />
            <ManualBullet icon={<Sun className="h-4 w-4 text-gold" />} text="Preventative habits" />
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {unlocked ? (
              <Link
                to="/owner-manual"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <BookOpen className="h-4 w-4" />
                Open your Owner's Manual
              </Link>
            ) : (
              <button
                onClick={handleUnlock}
                disabled={unlocking}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {unlocking ? "Unlocking…" : "Unlock now — $49"}
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              One-time. Yours forever. Updated each season.
            </p>
          </div>
        </section>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-gold" />
          AI-drafted, human-audited. Vital Logic doesn't diagnose — for any concerning symptom, please see a clinician.
        </p>
      </div>
    </Section>
  );
}

function ManualBullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground">
      {icon}
      <span>{text}</span>
    </li>
  );
}
