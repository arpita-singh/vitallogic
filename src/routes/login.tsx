import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth, getPreferredLandingPath, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: search.redirect ?? "/account" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — Vital Logic" },
      { name: "description", content: "Sign in to your Vital Logic account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err, claimedConsultId } = await signIn(email, password);
    if (err) {
      setSubmitting(false);
      setError(err.message);
      return;
    }
    // Priority: claimed consult > explicit ?redirect= > role-based default
    let target: string | undefined;
    if (claimedConsultId) {
      target = `/consult/${claimedConsultId}/result`;
    } else if (search.redirect) {
      target = search.redirect;
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      let roles: AppRole[] = [];
      if (uid) {
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);
        roles = (roleRows ?? []).map((r) => r.role as AppRole);
      }
      target = getPreferredLandingPath(roles);
    }
    setSubmitting(false);
    navigate({ to: target });
  };

  return (
    <Section className="py-16 md:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-4xl text-foreground md:text-5xl">
          Welcome <span className="text-gradient-gold">back</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          Sign in to view your consults and reviewed recommendations.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-4 py-3 text-foreground outline-none focus:border-gold"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm text-muted-foreground" htmlFor="password">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-gold hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-4 py-3 text-foreground outline-none focus:border-gold"
            />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 glow-gold"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6">
          <SocialAuthButtons redirectTo={search.redirect} />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="text-gold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </Section>
  );
}
