import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Section } from "@/components/section";
import { requestPasswordReset } from "@/utils/password-reset.functions";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: ({ context }) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: "/account" });
    }
  },
  head: () => ({
    meta: [
      { title: "Forgot password — Vital Logic" },
      {
        name: "description",
        content: "Reset your Vital Logic password. We'll email you a secure recovery link.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

type Status = "idle" | "submitting" | "sent" | "not_registered" | "rate_limited" | "error";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setMessage(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setClientError("Please enter your email address.");
      return;
    }
    if (!EMAIL_RE.test(trimmed) || trimmed.length > 255) {
      setClientError("That doesn't look like a valid email address.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await requestPasswordReset({
        data: { email: trimmed, origin: window.location.origin },
      });
      setStatus(res.status);
      setMessage(res.message ?? null);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  const reset = () => {
    setStatus("idle");
    setMessage(null);
    setClientError(null);
  };

  return (
    <Section className="py-16 md:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-4xl text-foreground md:text-5xl">
          Forgot your <span className="text-gradient-gold">password?</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          Enter the email associated with your account and we'll send you a secure link to set a
          new password.
        </p>

        {status === "sent" && (
          <div className="mt-8 rounded-lg border border-gold/40 bg-surface p-5 text-foreground">
            <p className="font-medium">Check your inbox.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              If the email is on file, a recovery link is on its way to{" "}
              <span className="text-foreground">{email.trim()}</span>. The link expires in one
              hour.
            </p>
            <div className="mt-5 flex gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Back to sign in
              </Link>
              <button
                type="button"
                onClick={reset}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {status === "not_registered" && (
          <div className="mt-8 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5 text-foreground">
            <p className="font-medium">This email is not registered with us.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn't find an account for{" "}
              <span className="text-foreground">{email.trim()}</span>. Double-check the address,
              or create a new account.
            </p>
            <div className="mt-5 flex gap-3">
              <Link
                to="/signup"
                search={{ email: email.trim(), redirect: undefined }}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Create an account
              </Link>
              <button
                type="button"
                onClick={reset}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Try another email
              </button>
            </div>
          </div>
        )}

        {(status === "idle" ||
          status === "submitting" ||
          status === "error" ||
          status === "rate_limited") && (
          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label className="mb-1.5 block text-sm text-muted-foreground" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "submitting"}
                className="w-full rounded-md border border-border bg-surface px-4 py-3 text-foreground outline-none focus:border-gold disabled:opacity-60"
              />
              {clientError && (
                <p className="mt-1.5 text-sm text-destructive">{clientError}</p>
              )}
            </div>

            {status === "rate_limited" && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                {message ?? "Too many attempts. Please try again shortly."}
              </div>
            )}
            {status === "error" && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {message ?? "Something went wrong. Please try again."}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 glow-gold"
            >
              {status === "submitting" ? "Sending…" : "Send recovery link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="text-gold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </Section>
  );
}