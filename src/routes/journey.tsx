import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/section";

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "Your Journey — Vital Logic" },
      {
        name: "description",
        content:
          "From AI intake to human audit to lifelong empowerment — see how a Vital Logic consult unfolds.",
      },
      { property: "og:title", content: "Your Journey — Vital Logic" },
      {
        property: "og:description",
        content: "AI Intake → DB Match → Human Audit → Empowerment.",
      },
    ],
  }),
  component: JourneyPage,
});

const steps = [
  {
    n: "01",
    title: "AI Intake",
    text: "A short, mobile-friendly conversation with our AI guide. Symptoms, lifestyle, history — captured in your own words.",
  },
  {
    n: "02",
    title: "Database Match",
    text: "Your intake is cross-referenced against a curated database spanning Ayurveda, naturopathy, plant medicine and modern functional protocols.",
  },
  {
    n: "03",
    title: "Human Audit",
    text: "A qualified practitioner reviews the AI draft, refines the recommendation and flags anything that needs further care.",
  },
  {
    n: "04",
    title: "Empowerment",
    text: "You receive a clear, personalised path forward — and the knowledge to understand why each step is there.",
  },
];

function JourneyPage() {
  return (
    <>
      <Section className="!pt-12 md:!pt-20">
        <SectionHeader
          eyebrow="The path"
          title="From symptom to system."
          subtitle="A typical Vital Logic journey — and why a human is in the loop at every meaningful step."
        />
      </Section>

      <Section className="!py-8">
        <ol className="relative mx-auto max-w-3xl space-y-6 border-l border-gold/30 pl-8 md:space-y-10">
          {steps.map((s) => (
            <li key={s.n} className="relative">
              <span className="absolute -left-[42px] flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 bg-background font-display text-sm text-gold glow-gold">
                {s.n}
              </span>
              <h3 className="font-display text-2xl md:text-3xl">{s.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <div className="text-center">
          <Link
            to="/consult"
            className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground glow-gold"
          >
            Start your journey
          </Link>
        </div>
      </Section>
    </>
  );
}
