import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import logo from "@/assets/vital-logic-logo.svg";
import { cn } from "@/lib/utils";
import {
  useAuth,
  getStoredViewMode,
  setStoredViewMode,
  type ViewMode,
} from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/philosophy", label: "Philosophy" },
  { to: "/pillars", label: "Four Pillars" },
  { to: "/journey", label: "Journey" },
  { to: "/origins", label: "Origins" },
  { to: "/integrity", label: "Integrity" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [readyCount, setReadyCount] = useState<number>(0);
  const [singleReadyConsultId, setSingleReadyConsultId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("patient");
  const { isAuthenticated, hasAnyRole, signOut, user } = useAuth();
  const navigate = useNavigate();
  const isExpert = hasAnyRole(["expert", "admin"]);

  // Initialise view mode from localStorage on mount
  useEffect(() => {
    setViewMode(getStoredViewMode());
  }, []);

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    setStoredViewMode(mode);
    setOpen(false);
    if (mode === "expert") {
      void navigate({ to: "/expert", search: { filter: "pending" } });
    } else {
      void navigate({ to: "/account" });
    }
  };

  useEffect(() => {
    if (!isExpert) {
      setQueueCount(0);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("prescriptions")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending_review", "escalated"]);
      if (!cancelled) setQueueCount(count ?? 0);
    };
    void load();
    const channel = supabase
      .channel("header-queue-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prescriptions" },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [isExpert]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setReadyCount(0);
      setSingleReadyConsultId(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      // RLS limits this to the patient's own approved prescriptions
      const { data, count } = await supabase
        .from("prescriptions")
        .select("id, consult_id, reviewed_at", { count: "exact" })
        .eq("status", "approved")
        .order("reviewed_at", { ascending: false });
      if (cancelled) return;
      const c = count ?? 0;
      setReadyCount(c);
      setSingleReadyConsultId(c === 1 && data && data[0] ? data[0].consult_id : null);
    };
    void load();
    const channel = supabase
      .channel("header-ready-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prescriptions" },
        () => void load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user]);

  const onSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate({ to: "/" });
  };

  // Resolve the destination for the notification badge
  const accountHref = singleReadyConsultId
    ? { to: "/consult/$consultId/result" as const, params: { consultId: singleReadyConsultId } }
    : readyCount > 0
      ? { to: "/account" as const, search: { ready: 1 } }
      : { to: "/account" as const };

  // Dual-role users see the toggle; mode controls which auth-area links show
  const showToggle = isAuthenticated && isExpert;
  const showExpertLink = isExpert && (!showToggle || viewMode === "expert");
  const showAccountLink = isAuthenticated && (!showToggle || viewMode === "patient");

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <img src={logo} alt="Vital Logic" className="h-9 w-9" />
          <span className="font-display text-xl tracking-tight">
            Vital <span className="text-gradient-gold">Logic</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-gold" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {showToggle && (
                <div
                  className="hidden items-center rounded-full border border-border bg-surface p-0.5 sm:inline-flex"
                  role="group"
                  aria-label="Switch view"
                >
                  <button
                    type="button"
                    onClick={() => switchView("patient")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      viewMode === "patient"
                        ? "bg-gold text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView("expert")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      viewMode === "expert"
                        ? "bg-gold text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Expert
                  </button>
                </div>
              )}
              {showExpertLink && (
                <Link
                  to="/expert"
                  search={{ filter: "pending" }}
                  className="hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold sm:inline-flex"
                >
                  Expert
                  {queueCount > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold/20 px-1.5 text-[10px] font-medium text-gold">
                      {queueCount}
                    </span>
                  )}
                </Link>
              )}
              {showAccountLink && (
                <Link
                  {...accountHref}
                  className="relative hidden items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-gold sm:inline-flex"
                  aria-label={
                    readyCount > 0
                      ? `Account — ${readyCount} prescription${readyCount === 1 ? "" : "s"} ready`
                      : "Account"
                  }
                >
                  Account
                  {readyCount > 0 && (
                    <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-semibold text-background">
                      {readyCount}
                    </span>
                  )}
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/consult"
                className="hidden rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 sm:inline-flex"
              >
                Start consult
              </Link>
            </>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "overflow-hidden border-t border-border/40 transition-all duration-300 md:hidden",
          open ? "max-h-[720px]" : "max-h-0",
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-4">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-3 text-base text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              activeProps={{ className: "text-gold bg-surface" }}
            >
              {item.label}
            </Link>
          ))}

          {isAuthenticated ? (
            <>
              {showToggle && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => switchView("patient")}
                    className={cn(
                      "rounded-full border px-3 py-2.5 text-sm font-medium transition-colors",
                      viewMode === "patient"
                        ? "border-gold bg-gold text-background"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    Patient view
                  </button>
                  <button
                    type="button"
                    onClick={() => switchView("expert")}
                    className={cn(
                      "rounded-full border px-3 py-2.5 text-sm font-medium transition-colors",
                      viewMode === "expert"
                        ? "border-gold bg-gold text-background"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    Expert view
                  </button>
                </div>
              )}
              {showAccountLink && (
                <Link
                  {...accountHref}
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center justify-between rounded-md px-3 py-3 text-base text-foreground hover:bg-surface"
                >
                  <span>My account</span>
                  {readyCount > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-semibold text-background">
                      {readyCount}
                    </span>
                  )}
                </Link>
              )}
              <Link
                to="/owner-manual"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base text-foreground hover:bg-surface"
              >
                Owner's Manual
              </Link>
              {showExpertLink && (
                <Link
                  to="/expert"
                  search={{ filter: "pending" }}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-md px-3 py-3 text-base text-gold hover:bg-surface"
                >
                  <span>Expert dashboard</span>
                  {queueCount > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold/20 px-1.5 text-[10px] font-medium text-gold">
                      {queueCount}
                    </span>
                  )}
                </Link>
              )}
              <button
                onClick={onSignOut}
                className="mt-2 inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm text-muted-foreground"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/consult"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
              >
                Start free consult
              </Link>
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="mt-1 inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm text-foreground"
              >
                Sign in
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
