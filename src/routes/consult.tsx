import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Section, SectionHeader } from "@/components/section";
import { IntakeStepper } from "@/components/consult/intake-stepper";
import { startConsult, type Intake } from "@/lib/consult-server";
import { useAuth } from "@/lib/auth";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async (intake: Intake) => {
    setSubmitting(true);
    try {
      const { consultId } = await startConsult({
        data: { intake, userId: user?.id ?? null },
      });
      // Stash for anonymous → account claim later
      if (!user) {
        try {
          localStorage.setItem("vl_consult_id", consultId);
        } catch {
          // ignore
        }
      }
      toast.success("Intake submitted — let's chat with your AI guide.");
      navigate({ to: "/consult/$consultId", params: { consultId } });
    } catch (e) {
      console.error(e);
      toast.error("Could not start your consult. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Section className="!pt-12 md:!pt-20">
        <SectionHeader
          eyebrow="Begin"
          title="Your first consult."
          subtitle="Five minutes. Honest answers. Reviewed by a qualified human practitioner before anything reaches you."
        />
      </Section>

      <Section className="!py-8">
        <IntakeStepper onComplete={handleComplete} submitting={submitting} />
      </Section>
    </>
  );
}
