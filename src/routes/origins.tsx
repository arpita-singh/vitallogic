import { createFileRoute } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/section";

export const Route = createFileRoute("/origins")({
  head: () => ({
    meta: [
      { title: "Wisdom Origins — Vital Logic" },
      {
        name: "description",
        content:
          "Ayurveda, Western Naturopathy, Indigenous medicine, Plant medicine — the ancient traditions that inform Vital Logic.",
      },
      { property: "og:title", content: "Wisdom Origins — Vital Logic" },
      {
        property: "og:description",
        content: "The global wisdom traditions woven into our consults.",
      },
    ],
  }),
  component: OriginsPage,
});

const origins = [
  {
    title: "Ayurveda",
    region: "Indian subcontinent · 5,000+ years",
    text: "The science of life. Doshas, agni, ojas — a complete theory of constitution and balance refined over millennia.",
  },
  {
    title: "Traditional Chinese Medicine",
    region: "East Asia · 3,000+ years",
    text: "Qi, meridians, the five elements. A profound systems-view of energy and form, validated daily by hundreds of millions.",
  },
  {
    title: "Western Naturopathy",
    region: "Europe & Americas · 200 years",
    text: "Vis medicatrix naturae — the healing power of nature. Diet, hydrotherapy, botanical medicine, lifestyle.",
  },
  {
    title: "Indigenous Medicine",
    region: "Worldwide · time immemorial",
    text: "Place-based, plant-based, ceremony-rich healing traditions held by First Peoples across every continent.",
  },
  {
    title: "Plant & Psychedelic Medicine",
    region: "Worldwide · ancestral to emerging",
    text: "From entheogens used in ritual to clinical-grade psilocybin and ketamine therapies — applied with rigour and respect.",
  },
  {
    title: "Functional & Modern Science",
    region: "20th–21st century",
    text: "Microbiome science, nutrigenomics, chronobiology. The latest evidence woven into the oldest wisdom.",
  },
];

function OriginsPage() {
  return (
    <>
      <Section className="!pt-12 md:!pt-20">
        <SectionHeader
          eyebrow="Roots"
          title="Wisdom across time."
          subtitle="Vital Logic stands on the shoulders of every healing tradition humanity has cultivated. We honour them by integrating them — with consent, citation and care."
        />
      </Section>

      <Section className="!py-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {origins.map((o) => (
            <div
              key={o.title}
              className="rounded-2xl border border-border bg-surface/40 p-6 transition-colors hover:border-gold/40"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-gold">{o.region}</p>
              <h3 className="mt-2 font-display text-2xl">{o.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.text}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
