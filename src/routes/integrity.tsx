import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Activity, FileCheck2, Lock } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";

export const Route = createFileRoute("/integrity")({
  head: () => ({
    meta: [
      { title: "Integrity Layer — Vital Logic" },
      {
        name: "description",
        content:
          "Continuous AUST L / ARTG verification, 99.9% uptime, and engineered guardrails — the SRE backbone of Vital Logic.",
      },
      { property: "og:title", content: "Integrity Layer — Vital Logic" },
      {
        property: "og:description",
        content: "Engineered trust: regulator checks, uptime guarantees, and human oversight.",
      },
    ],
  }),
  component: IntegrityPage,
});

const guarantees = [
  {
    icon: ShieldCheck,
    title: "Human-in-the-loop, always",
    text: "No recommendation reaches you without review by a qualified practitioner. AI proposes; humans approve.",
  },
  {
    icon: FileCheck2,
    title: "AUST L / ARTG verification",
    text: "Every product in our marketplace is continuously cross-checked against Australia's Therapeutic Goods registers by our automated integrity bots.",
  },
  {
    icon: Activity,
    title: "99.9% uptime promise",
    text: "Built on edge infrastructure with full observability. When it matters, we're there.",
  },
  {
    icon: Lock,
    title: "Privacy by design",
    text: "Your health data is yours. Encrypted at rest and in transit. Never sold, never used to train external models.",
  },
];

function IntegrityPage() {
  return (
    <>
      <Section className="!pt-12 md:!pt-20">
        <SectionHeader
          eyebrow="The trust layer"
          title="Engineered integrity."
          subtitle="Trust is not a marketing claim. It's a system. Here's how we build it."
        />
      </Section>

      <Section className="!py-8">
        <div className="grid gap-5 md:grid-cols-2">
          {guarantees.map((g) => (
            <div
              key={g.title}
              className="rounded-2xl border border-border bg-surface/40 p-7"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                <g.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-2xl">{g.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{g.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="rounded-3xl border border-violet/30 bg-gradient-to-br from-surface to-background p-10 text-center glow-violet md:p-14">
          <h3 className="font-display text-3xl md:text-4xl">
            Built by <span className="text-gradient-gold">SREs</span>, for human well-being.
          </h3>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            A decade of site reliability engineering applied to the most important system of all —
            the human body.
          </p>
        </div>
      </Section>
    </>
  );
}
