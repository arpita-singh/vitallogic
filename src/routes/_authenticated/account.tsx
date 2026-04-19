import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { claimConsult } from "@/lib/consult-server";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [{ title: "My account — Vital Logic" }],
  }),
  component: AccountPage,
});

type PrescriptionRow = {
  id: string;
  status: string;
  reviewed_at: string | null;
};

type ConsultRow = {
  id: string;
  status: string;
  created_at: string;
  prescriptions: PrescriptionRow[] | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "In progress",
  pending_review: "Awaiting review",
  approved: "Approved",
  rejected: "Reviewed",
  escalated: "Priority review",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-border bg-muted/30 text-muted-foreground",
  pending_review: "border-gold/40 bg-gold/10 text-gold",
  approved: "border-violet/40 bg-violet/10 text-violet",
  rejected: "border-border bg-muted/30 text-muted-foreground",
  escalated: "border-destructive/40 bg-destructive/10 text-destructive",
};

function AccountPage() {
  const { user, roles, signOut, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string>("");
  const [consults, setConsults] = useState<ConsultRow[]>([]);

  // Claim any anonymous consult stashed in localStorage
  useEffect(() => {
    if (!user) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("vl_consult_id");
    } catch {
      // ignore
    }
    if (stored) {
      claimConsult({ data: { consultId: stored } })
        .then(() => {
          try {
            localStorage.removeItem("vl_consult_id");
          } catch {
            // ignore
          }
        })
        .catch((e) => console.error("claim failed", e))
        .finally(() => loadConsults());
    } else {
      loadConsults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadConsults = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("consults")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setConsults((data ?? []) as ConsultRow[]);
  };

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

        {/* Consults */}
        <div className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-2xl text-foreground">Your consults</h2>
            <Link
              to="/consult"
              className="text-xs uppercase tracking-wider text-gold hover:opacity-80"
            >
              + New consult
            </Link>
          </div>
          {consults.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-center">
              <p className="text-sm text-muted-foreground">
                You haven't started a consult yet.
              </p>
              <Link
                to="/consult"
                className="mt-4 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
              >
                Begin your first consult
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {consults.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/consult/$consultId/result"
                    params={{ consultId: c.id }}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-gold/50"
                  >
                    <div>
                      <p className="text-sm text-foreground">
                        {new Date(c.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Consult #{c.id.slice(0, 8)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider ${
                        STATUS_STYLES[c.status] ?? STATUS_STYLES.draft
                      }`}
                    >
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasAnyRole(["expert", "admin"]) && (
          <Link
            to="/expert"
            className="mt-6 block rounded-2xl border border-gold/40 bg-surface p-6 transition-all hover:border-gold"
          >
            <h2 className="font-display text-2xl text-gradient-gold">Expert dashboard</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review pending consults and approve recommendations.
            </p>
          </Link>
        )}

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
