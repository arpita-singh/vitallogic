import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const navItems = [
  { to: "/philosophy", label: "Philosophy" },
  { to: "/pillars", label: "Four Pillars" },
  { to: "/journey", label: "Journey" },
  { to: "/origins", label: "Origins" },
  { to: "/integrity", label: "Integrity" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, hasAnyRole, signOut } = useAuth();
  const navigate = useNavigate();

  const onSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet to-gold">
            <Sparkles className="h-4 w-4 text-background" />
          </div>
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
              {hasAnyRole(["expert", "admin"]) && (
                <Link
                  to="/expert"
                  className="hidden text-sm text-muted-foreground transition-colors hover:text-gold sm:inline"
                >
                  Expert
                </Link>
              )}
              <Link
                to="/account"
                className="hidden rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-gold sm:inline-flex"
              >
                Account
              </Link>
            </>
          ) : (
            <Link
              to="/consult"
              className="hidden rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 sm:inline-flex"
            >
              Start consult
            </Link>
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
          open ? "max-h-[640px]" : "max-h-0",
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
              <Link
                to="/account"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-md px-3 py-3 text-base text-foreground hover:bg-surface"
              >
                My account
              </Link>
              {hasAnyRole(["expert", "admin"]) && (
                <Link
                  to="/expert"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-base text-gold hover:bg-surface"
                >
                  Expert dashboard
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
