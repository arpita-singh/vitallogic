import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { claimPendingConsult, getPendingConsult } from "@/lib/claim-consult";

type AccountSearch = { ready?: number };

export const Route = createFileRoute("/_authenticated/account")({
  validateSearch: (search: Record<string, unknown>): AccountSearch => ({
    ready: search.ready === "1" || search.ready === 1 ? 1 : undefined,
  }),
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
  const search = Route.useSearch();
  const [displayName, setDisplayName] = useState<string>("");
  const [consults, setConsults] = useState<ConsultRow[]>([]);
  const [highlightReady, setHighlightReady] = useState(false);
  const [pendingOrphan, setPendingOrphan] = useState<string | null>(null);
  const readyBannerRef = useRef<HTMLDivElement | null>(null);

  // On mount: try to claim any remembered pending consult, then load.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = async () => {
      const claimed = await claimPendingConsult(user.id);
      if (cancelled) return;
      await loadConsults();
      // If after claiming there's still a pending pointer (e.g. claim failed
      // because a different account owns it), surface a fallback notice.
      if (!claimed) {
        const stillPending = getPendingConsult();
        if (stillPending) setPendingOrphan(stillPending);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadConsults = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("consults")
      .select("id, status, created_at, prescriptions(id, status, reviewed_at)")
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

  // Highlight the ready banner when arriving via the header notification (?ready=1)
  useEffect(() => {
    if (search.ready !== 1) return;
    if (consults.length === 0) return;
    const hasReady = consults.some((c) =>
      (c.prescriptions ?? []).some((p) => p.status === "approved"),
    );
    if (!hasReady) return;
    const t = window.setTimeout(() => {
      readyBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightReady(true);
      window.setTimeout(() => setHighlightReady(false), 2400);
    }, 100);
    return () => window.clearTimeout(t);
  }, [search.ready, consults]);

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

        {/* Approved-prescription banner */}
        {(() => {
          const ready = consults.filter((c) =>
            (c.prescriptions ?? []).some((p) => p.status === "approved"),
          );
          if (ready.length === 0) return null;
          return (
            <div
              ref={readyBannerRef}
              className={`mt-10 rounded-2xl border border-gold/40 bg-gold/5 p-6 transition-shadow duration-500 ${
                highlightReady ? "ring-2 ring-gold ring-offset-2 ring-offset-background animate-pulse shadow-[0_0_40px_rgba(212,175,55,0.35)]" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-xl text-gold" aria-hidden>
                  ★
                </span>
                <div className="flex-1">
                  <h2 className="font-display text-xl text-gradient-gold">
                    {ready.length === 1
                      ? "Your prescription is ready"
                      : `You have ${ready.length} prescriptions ready to view`}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your practitioner has approved your recommendations.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {ready.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-background/60 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm text-foreground">
                            {new Date(c.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            consult
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            #{c.id.slice(0, 8)}
                          </p>
                        </div>
                        <Link
                          to="/consult/$consultId/result"
                          params={{ consultId: c.id }}
                          className="inline-flex items-center gap-1 rounded-full bg-gold px-4 py-2 text-xs font-medium uppercase tracking-wider text-background transition-opacity hover:opacity-90"
                        >
                          View prescription →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pending-but-unattached fallback notice */}
        {pendingOrphan && (
          <div className="mt-6 rounded-2xl border border-violet/40 bg-violet/5 p-5">
            <p className="text-sm text-foreground">
              We found a recent consult that isn't linked to this account yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Open it directly to attach it to your account, or sign in with the email you used originally.
            </p>
            <Link
              to="/consult/$consultId/result"
              params={{ consultId: pendingOrphan }}
              className="mt-3 inline-flex rounded-full border border-violet/60 px-4 py-2 text-xs uppercase tracking-wider text-violet hover:bg-violet/10"
            >
              Open consult
            </Link>
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
