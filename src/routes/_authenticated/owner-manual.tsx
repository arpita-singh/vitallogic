import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Sparkles, Heart, Sun, Compass } from "lucide-react";
import { Section } from "@/components/section";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/owner-manual")({
  head: () => ({
    meta: [{ title: "Your Owner's Manual — Vital Logic" }],
  }),
  component: OwnerManualPage,
});

function OwnerManualPage() {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [purchasesRes, profileRes] = await Promise.all([
        supabase
          .from("user_purchases")
          .select("has_unlocked_education")
          .eq("user_id", user.id)
          .eq("has_unlocked_education", true)
          .limit(1),
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setUnlocked((purchasesRes.data?.length ?? 0) > 0);
      setDisplayName(profileRes.data?.display_name ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (unlocked === null) {
    return (
      <Section>
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      </Section>
    );
  }

  if (!unlocked) {
    return (
      <Section>
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-surface p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-border bg-background">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="mt-6 font-display text-3xl text-foreground md:text-4xl">
            Your Owner's Manual is locked
          </h1>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Complete a consult and unlock to receive your personalised, lifelong preventative-care
            guide — built around your unique constitution.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/consult"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Start a consult
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Back home
            </Link>
          </div>
        </div>
      </Section>
    );
  }

  const greetingName = displayName || "friend";

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-gold">
            <Sparkles className="h-3.5 w-3.5" />
            Your Owner's Manual
          </div>
          <h1 className="mt-6 font-display text-4xl leading-[1.05] text-foreground md:text-6xl">
            A guide built for you,{" "}
            <span className="text-gradient-gold">{greetingName}</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            A living document drawn from your consult. Your unique design, your patterns, and the
            rhythms that keep you in flow.
          </p>
          <div className="divider-gold mx-auto mt-8 w-32" />
        </div>

        {/* Sections */}
        <div className="mt-16 space-y-12">
          <ManualSection
            eyebrow="Section 01"
            icon={<Compass className="h-5 w-5 text-gold" />}
            title="Your Unique Design"
            paragraphs={[
              "Every person carries a constitutional signature — a way the body holds heat, moves fluid, gathers energy and lets it go. Yours leans toward warmth and momentum, with a tendency to run a little dry when sleep is short.",
              "When you honour this design, things feel almost effortless. When you fight it — by pushing through tiredness, skipping meals, or under-hydrating — small symptoms accumulate and turn into the patterns you came to us with.",
            ]}
          />

          <ManualSection
            eyebrow="Section 02"
            icon={<Heart className="h-5 w-5 text-gold" />}
            title="Mind-Body Connection"
            paragraphs={[
              "Your nervous system is the conductor of every other system. From your consult, three signals stand out: shallow sleep, accelerated thought late at night, and digestion that softens under stress.",
              "These are not separate problems. They are the same conversation, told in three voices. The work is to give the nervous system a daily place to rest — even briefly — so the rest of the body can recalibrate.",
            ]}
          />

          <ManualSection
            eyebrow="Section 03"
            icon={<Sun className="h-5 w-5 text-gold" />}
            title="Preventative Habits"
            paragraphs={[
              "Daily: ten minutes of unstructured stillness in the morning before screens, warm water with lemon, and a slow protein-forward breakfast within 90 minutes of waking.",
              "Weekly: one full rest day with no agenda, two longer walks in nature, and a single meal you cook unhurried from raw ingredients.",
              "Seasonal: revisit this manual at each solstice and equinox. Your design is stable, but the practice that supports it shifts with the light.",
            ]}
          />
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This is a placeholder version of your manual. A fully personalised, AI-drafted edition
            tailored to your consult is coming soon.
          </p>
        </div>
      </div>
    </Section>
  );
}

function ManualSection({
  eyebrow,
  icon,
  title,
  paragraphs,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  paragraphs: string[];
}) {
  return (
    <article className="rounded-3xl border border-border bg-surface p-8 md:p-10">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs uppercase tracking-[0.25em] text-gold">{eyebrow}</p>
      </div>
      <h2 className="mt-3 font-display text-3xl text-foreground md:text-4xl">{title}</h2>
      <div className="divider-gold mt-5 w-24" />
      <div className="mt-6 space-y-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-base leading-relaxed text-foreground/90">
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}
