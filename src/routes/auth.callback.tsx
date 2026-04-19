import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimPendingConsult } from "@/lib/claim-consult";
import { Section } from "@/components/section";
import { getPreferredLandingPath, type AppRole } from "@/lib/auth";

type CallbackSearch = { redirect?: string };

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Signing you in — Vital Logic" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Give the auth listener a tick to set the session from the OAuth fragment.
      await new Promise((r) => setTimeout(r, 100));
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      let target = search.redirect;
      if (userId) {
        const claimedId = await claimPendingConsult(userId);
        if (claimedId) {
          target = `/consult/${claimedId}/result`;
        } else if (!target) {
          const { data: roleRows } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          const roles = (roleRows ?? []).map((r) => r.role as AppRole);
          target = getPreferredLandingPath(roles);
        }
      }
      if (!target) target = "/account";
      if (!cancelled) void navigate({ to: target });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, search.redirect]);

  return (
    <Section>
      <p className="text-center text-muted-foreground">Signing you in…</p>
    </Section>
  );
}
