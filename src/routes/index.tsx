import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, Database, ShieldCheck, GraduationCap, Sparkles } from "lucide-react";
import heroLotus from "@/assets/hero-lotus.jpg";
import { Section, SectionHeader } from "@/components/section";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vital Logic — Your Natural Health Hub" },
      {
        name: "description",
        content:
          "AI-guided wellness consults, audited by humans. From medication to education — your personal health operating system.",
      },
      { property: "og:title", content: "Vital Logic — Your Natural Health Hub" },
      {
        property: "og:description",
        content:
          "From medication to education. AI-guided, human-audited natural wellness recommendations.",
      },
      { property: "og:image", content: heroLotus },
      { name: "twitter:image", content: heroLotus },
    ],
  }),
  component: Home,
});

const pillars = [
  { icon: Brain, title: "Consult", text: "AI symptom intake informed by global wisdom traditions." },
  { icon: Database, title: "Prescribe", text: "Personalised remedies cross-referenced against a curated database." },
  { icon: ShieldCheck, title: "Medicate", text: "Marketplace of vetted, regulator-checked products. (Coming soon)" },
  { icon: GraduationCap, title: "Educate", text: "Your personal Owner's Manual — long-term empowerment." },
];

function Home() {
  const { isAuthenticated } = useAuth();
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-violet/20 blur-[120px]" />
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pt-12 pb-20 text-center md:pt-20 md:pb-32">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-surface/60 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3 w-3" />
            From medication to education
          </p>

          <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl lg:text-[5.5rem]">
            Your <span className="text-gradient-gold">Natural</span>
            <br />
            Health Hub
          </h1>

          <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            An AI-guided, human-audited wellness operating system. We unite ancient remedies and
            modern science to help you understand — not just treat — your body.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/consult"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 glow-gold"
            >
              Start your free consult
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/philosophy"
              className="inline-flex items-center justify-center rounded-full border border-border px-7 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Read our philosophy
            </Link>
          </div>

          {!isAuthenticated && (
            <p className="mt-5 text-sm text-muted-foreground">
              Already had a consult?{" "}
              <Link to="/login" className="text-gold hover:underline">
                Sign in to view your prescription
              </Link>
            </p>
          )}

          <div className="relative mt-14 w-full max-w-xl">
            <div className="absolute inset-0 -z-10 rounded-full bg-violet/20 blur-3xl" />
            <img
              src={heroLotus}
              alt="Golden lotus interwoven with circuit-board patterns — symbol of Vital Logic"
              width={1024}
              height={1024}
              className="mx-auto h-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* MISSION */}
      <Section>
        <SectionHeader
          eyebrow="Our mission"
          title="Heal the body. Empower the mind."
          subtitle="The pharmaceutical model treats symptoms in isolation. We believe the body is a system — and that real healing comes from understanding the whole."
        />
      </Section>

      {/* FROM MEDICATION TO EDUCATION */}
      <Section className="!py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface/40 p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Today</p>
            <h3 className="mt-2 font-display text-3xl">A pill for an ill</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A reactive system. Symptoms suppressed, root causes ignored, dependency normalised.
              Care is fragmented; the patient is passive.
            </p>
          </div>
          <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-surface to-surface/40 p-8 glow-gold">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">Vital Logic</p>
            <h3 className="mt-2 font-display text-3xl text-gradient-gold">A system for life</h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">
              Proactive. Holistic. Personalised. AI-guided wisdom from across human history,
              audited by humans you can trust. You stay in the driver's seat of your own health.
            </p>
          </div>
        </div>
      </Section>

      {/* PILLARS */}
      <Section>
        <SectionHeader
          eyebrow="The architecture"
          title="Four pillars, one system"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <div
              key={p.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface/40 p-6 transition-colors hover:border-gold/40"
            >
              <div className="absolute right-3 top-3 font-display text-5xl text-border">
                0{i + 1}
              </div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-2xl">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            to="/pillars"
            className="inline-flex items-center gap-2 text-sm text-gold hover:underline"
          >
            Explore the pillars in depth
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Section>

      {/* CTA */}
      <Section>
        <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-surface to-background p-10 text-center md:p-16">
          <div className="absolute -top-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-violet/30 blur-3xl" />
          {isAuthenticated ? (
            <>
              <h2 className="font-display text-4xl md:text-5xl">
                View your <span className="text-gradient-gold">dashboard</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                Check your consults, prescriptions, and Owner's Manual in one place.
              </p>
              <Link
                to="/account"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground glow-gold"
              >
                Go to dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-display text-4xl md:text-5xl">
                Begin your <span className="text-gradient-gold">first consult</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                Five minutes. Free. Reviewed by a human practitioner before you receive anything.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/consult"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground glow-gold"
                >
                  Start now
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-gold hover:underline"
                >
                  Returning? Sign in
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}
        </div>
      </Section>
    </>
  );
}
