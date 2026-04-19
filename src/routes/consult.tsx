import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, MessageCircle, Clock } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";

export const Route = createFileRoute("/consult")({
  head: () => ({
    meta: [
      { title: "Start a Consult — Vital Logic" },
      {
        name: "description",
        content:
          "Begin a free AI-guided wellness consult. Reviewed by a qualified human practitioner before any recommendation reaches you.",
      },
      { property: "og:title", content: "Start a Consult — Vital Logic" },
      {
        property: "og:description",
        content: "AI-guided. Human-audited. Always free for your first consult.",
      },
    ],
  }),
  component: ConsultPage,
});

function ConsultPage() {
  return (
    <>
      <Section className="!pt-12 md:!pt-20">
        <SectionHeader
          eyebrow="Begin"
          title="Your first consult."
          subtitle="Free. Five minutes. Reviewed by a qualified human practitioner before anything reaches you."
        />
      </Section>

      <Section className="!py-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-gold/30 bg-gradient-to-br from-surface to-background p-8 text-center md:p-12 glow-gold">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-6 font-display text-3xl md:text-4xl">
            The consult experience opens soon.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            We're connecting the AI intake, expert review queue and your personal account. In the
            meantime, learn how the journey will work.
          </p>

          <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
            <Step icon={MessageCircle} label="Guided intake" body="A short, gentle conversation." />
            <Step icon={Sparkles} label="AI draft" body="Recommendations grounded in evidence." />
            <Step icon={Clock} label="Human audit" body="Reviewed before you receive it." />
          </div>

          <Link
            to="/journey"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground"
          >
            See the full journey
          </Link>
        </div>
      </Section>
    </>
  );
}

function Step({
  icon: Icon,
  label,
  body,
}: {
  icon: typeof Sparkles;
  label: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <Icon className="h-5 w-5 text-gold" />
      <p className="mt-2 font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
