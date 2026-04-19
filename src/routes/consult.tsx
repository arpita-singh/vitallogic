import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Section, SectionHeader } from "@/components/section";
import { IntakeStepper } from "@/components/consult/intake-stepper";
import { startConsultRequest } from "@/lib/consult-access";
import type { Intake } from "@/lib/consult-types";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { rememberPendingConsult } from "@/lib/claim-consult";

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
  const [profileName, setProfileName] = useState<string>("");

  // Prefill name for signed-in users from their profile.
  useEffect(() => {
    if (!user) {
      setProfileName("");
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.display_name) setProfileName(data.display_name);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleComplete = async (intake: Intake) => {
    setSubmitting(true);
    try {
      const { consultId, anonToken } = await startConsultRequest(intake);
      // Stash for anonymous → account claim later (unified helper).
      // The anonToken is required to read/update the consult later, so it
      // must be stored alongside the consultId.
      if (!user) {
        rememberPendingConsult(consultId, anonToken);
      }
      toast.success("Intake submitted — we'll email you when your recommendation is ready.");
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
        <IntakeStepper
          onComplete={handleComplete}
          submitting={submitting}
          signedIn={!!user}
          initialContactEmail={user?.email ?? ""}
          initialContactName={profileName}
        />
      </Section>
    </>
  );
}
