import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/section";

export const Route = createFileRoute("/_authenticated/_expert/expert")({
  head: () => ({
    meta: [{ title: "Expert dashboard — Vital Logic" }],
  }),
  component: ExpertDashboard,
});

function ExpertDashboard() {
  return (
    <Section className="py-16 md:py-24">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-4xl text-foreground md:text-5xl">
          Expert <span className="text-gradient-gold">queue</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          Pending consults awaiting your review will appear here.
        </p>

        <div className="mt-12 rounded-lg border border-dashed border-border bg-surface/50 p-12 text-center">
          <p className="font-display text-2xl text-foreground">No consults yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The full review workflow ships in Phase 3 — claim, edit, approve, audit.
          </p>
        </div>
      </div>
    </Section>
  );
}
