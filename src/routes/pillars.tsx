import { createFileRoute } from "@tanstack/react-router";
import { Brain, Database, ShieldCheck, GraduationCap } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";

export const Route = createFileRoute("/pillars")({
  head: () => ({
    meta: [
      { title: "The Four Pillars — Vital Logic" },
      {
        name: "description",
        content:
          "Consult, Recommend, Medicate, Educate — the four pillars of the Vital Logic health operating system.",
      },
      { property: "og:title", content: "The Four Pillars — Vital Logic" },
      {
        property: "og:description",
        content: "Consult, Recommend, Medicate, Educate — the architecture of holistic care.",
      },
    ],
  }),
  component: PillarsPage,
});

const pillars = [
  {
    icon: Brain,
    title: "Consult",
    tag: "Pillar 01",
    body: "An AI-guided intake informed by Ayurveda, Traditional Chinese Medicine, Western naturopathy, indigenous wisdom and contemporary functional medicine. The chatbot listens, clarifies and surfaces possibilities — never diagnoses.",
  },
  {
    icon: Database,
    title: "Recommend",
    tag: "Pillar 02",
    body: "Recommendations cross-referenced against a curated database of remedies, dosages, contraindications and interactions. Drafted by AI, audited by a qualified human practitioner before it ever reaches you.",
  },
  {
    icon: ShieldCheck,
    title: "Medicate",
    tag: "Pillar 03 — Coming soon",
    body: "A marketplace of vetted, regulator-checked products from trusted suppliers. Every listing continually verified against AUST L / ARTG records by our integrity layer.",
  },
  {
    icon: GraduationCap,
    title: "Educate",
    tag: "Pillar 04 — Coming soon",
    body: "Your personal Owner's Manual — a living document that explains your terrain, your patterns and your protocols, so you can become the expert on yourself.",
  },
];

function PillarsPage() {
  return (
    <>
      <Section className="!pt-12 md:!pt-20">
        <SectionHeader
          eyebrow="Architecture"
          title="Four pillars. One system."
          subtitle="Each pillar reinforces the others. Together they form the world's first end-to-end natural health operating system."
        />
      </Section>

      <Section className="!py-8">
        <div className="space-y-5">
          {pillars.map((p, i) => (
            <article
              key={p.title}
              className="group relative overflow-hidden rounded-3xl border border-border bg-surface/40 p-6 transition-colors hover:border-gold/40 md:p-10"
            >
              <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start md:gap-10">
                <div className="flex items-start gap-4 md:flex-col">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
                    <p.icon className="h-6 w-6" />
                  </div>
                  <div className="font-display text-6xl text-border md:mt-2">
                    0{i + 1}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gold">{p.tag}</p>
                  <h2 className="mt-1 font-display text-3xl md:text-4xl">{p.title}</h2>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
