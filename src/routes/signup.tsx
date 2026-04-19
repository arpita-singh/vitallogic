import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Section } from "@/components/section";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";

type SignupSearch = { redirect?: string; email?: string };

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): SignupSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: search.redirect ?? "/account" });
    }
  },
  head: () => ({
    meta: [
      { title: "Create account — Vital Logic" },
      { name: "description", content: "Create your Vital Logic account to track consults." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err, claimedConsultId } = await signUp(email, password, displayName);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSubmitted(true);
    const target = claimedConsultId
      ? `/consult/${claimedConsultId}/result`
      : (search.redirect ?? "/account");
    setTimeout(() => navigate({ to: target }), 800);
  };

  return (
    <Section className="py-16 md:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-4xl text-foreground md:text-5xl">
          Begin your <span className="text-gradient-gold">journey</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          Create an account to save consults and receive expert-reviewed recommendations.
        </p>

        {submitted ? (
          <div className="mt-8 rounded-lg border border-gold/30 bg-surface p-5 text-foreground">
            Account created. Redirecting…
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground" htmlFor="displayName">
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-4 py-3 text-foreground outline-none focus:border-gold"
                />
              </div>
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
                <label className="mb-1.5 block text-sm text-muted-foreground" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-4 py-3 text-foreground outline-none focus:border-gold"
                />
                <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
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
                {submitting ? "Creating…" : "Create account"}
              </button>
            </form>

            <div className="mt-6">
              <SocialAuthButtons redirectTo={search.redirect} />
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-gold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </Section>
  );
}
