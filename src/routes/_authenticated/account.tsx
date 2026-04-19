import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [{ title: "My account — Vital Logic" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, roles, signOut, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <Section className="py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl text-foreground md:text-5xl">
          Hello, <span className="text-gradient-gold">{displayName || "friend"}</span>
        </h1>
        <p className="mt-3 text-muted-foreground">{user?.email}</p>

        {roles.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {roles.map((r) => (
              <span
                key={r}
                className="rounded-full border border-violet/40 bg-violet/10 px-3 py-1 text-xs uppercase tracking-wider text-violet"
              >
                {r}
              </span>
            ))}
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-6">
            <h2 className="font-display text-2xl text-foreground">My consults</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your past and pending consults will appear here.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">Coming in Phase 3.</p>
          </div>

          {hasAnyRole(["expert", "admin"]) && (
            <Link
              to="/expert"
              className="rounded-lg border border-gold/40 bg-surface p-6 transition-all hover:border-gold"
            >
              <h2 className="font-display text-2xl text-gradient-gold">Expert dashboard</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Review pending consults and approve recommendations.
              </p>
            </Link>
          )}
        </div>

        <button
          onClick={onSignOut}
          className="mt-10 inline-flex rounded-full border border-border px-6 py-3 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </Section>
  );
}
