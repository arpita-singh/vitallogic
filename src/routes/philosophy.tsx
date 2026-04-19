import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, SectionHeader } from "@/components/section";

export const Route = createFileRoute("/philosophy")({
  head: () => ({
    meta: [
      { title: "Philosophy — Vital Logic" },
      {
        name: "description",
        content:
          "From a pill for an ill to systemic empowerment. The Vital Logic philosophy: heal the whole, not the part.",
      },
      { property: "og:title", content: "Philosophy — Vital Logic" },
      {
        property: "og:description",
        content: "From a pill for an ill to systemic empowerment. Heal the whole, not the part.",
      },
    ],
  }),
  component: PhilosophyPage,
});

function PhilosophyPage() {
  return (
    <>
      <Section className="!pt-12 md:!pt-20">
        <SectionHeader
          eyebrow="Why we exist"
          title="A pill for an ill is not a system for life."
          subtitle="Modern medicine is brilliant at acute care and broken at chronic care. We are building the missing layer."
        />
      </Section>

      <Section className="!py-8">
        <div className="mx-auto max-w-3xl space-y-10 text-lg leading-relaxed text-foreground/85">
          <p>
            For a century the dominant model has been simple: identify a symptom, prescribe a
            molecule, suppress the signal. It works in emergencies. It fails in lives.
          </p>
          <p>
            <span className="font-display text-2xl text-gold">The body is a system.</span> A
            symptom is a message. When we silence the messenger, we lose the meaning.
          </p>
          <p>
            Vital Logic is the world's first <span className="text-gold">health operating
            system</span> — built on the premise that humans heal best when they are seen as
            wholes, supported by ancient wisdom, cross-checked by modern science, and trusted as
            the authors of their own well-being.
          </p>
        </div>
      </Section>

      <Section>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              h: "Holism",
              p: "Mind, body, environment — treated as one continuous system, not isolated parts.",
            },
            {
              h: "Empowerment",
              p: "Education over dependency. Tools over prescriptions. Owners, not patients.",
            },
            {
              h: "Integrity",
              p: "Every recommendation is reviewed by a qualified human. Nothing is automated all the way down.",
            },
          ].map((card) => (
            <div key={card.h} className="rounded-2xl border border-border bg-surface/40 p-7">
              <h3 className="font-display text-2xl text-gold">{card.h}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{card.p}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="text-center">
          <Link
            to="/pillars"
            className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground glow-gold"
          >
            See the four pillars
          </Link>
        </div>
      </Section>
    </>
  );
}
