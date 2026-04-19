import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";

type Props = { redirectTo?: string };

export function SocialAuthButtons({ redirectTo }: Props) {
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);

  const signIn = async (provider: "google" | "apple") => {
    setBusy(provider);
    const callback =
      window.location.origin +
      "/auth/callback" +
      (redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : "");
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: callback });
    if (result.error) {
      toast.error(`Couldn't sign in with ${provider === "google" ? "Google" : "Apple"}.`);
      setBusy(null);
      return;
    }
    if (result.redirected) return; // browser navigates away
    // Tokens already set — go to callback to claim any pending consult.
    window.location.href = callback;
  };

  return (
    <div className="space-y-3">
      <div className="relative flex items-center">
        <span className="h-px flex-1 bg-border" />
        <span className="px-3 text-xs uppercase tracking-wider text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={() => signIn("google")}
        disabled={busy !== null}
        className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
      >
        <GoogleIcon />
        {busy === "google" ? "Connecting…" : "Continue with Google"}
      </button>
      <button
        type="button"
        onClick={() => signIn("apple")}
        disabled={busy !== null}
        className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-50"
      >
        <AppleIcon />
        {busy === "apple" ? "Connecting…" : "Continue with Apple"}
      </button>
      <button
        type="button"
        disabled
        title="Facebook sign-in requires extra setup — coming soon."
        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-muted-foreground opacity-60"
      >
        <FacebookIcon />
        Continue with Facebook
        <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider">
          soon
        </span>
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.3 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.3 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.3C29.4 35 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.7 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.3C40.8 36 44 30.5 44 24c0-1.3-.2-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.18-1.13 2.97-.78.86-2.05 1.52-3.06 1.44-.13-1.1.42-2.24 1.1-2.97.78-.83 2.13-1.46 3.09-1.44zM20.5 17.27c-.55 1.27-.81 1.83-1.52 2.94-.99 1.55-2.4 3.49-4.13 3.5-1.54.02-1.94-1-4.04-.99-2.1.01-2.54 1.01-4.08.99-1.74-.01-3.07-1.76-4.06-3.31C-.06 16.41-.36 11.27 1.49 8.42c1.31-2.02 3.39-3.21 5.34-3.21 1.99 0 3.24 1.09 4.89 1.09 1.6 0 2.57-1.09 4.87-1.09 1.74 0 3.58.95 4.89 2.59-4.3 2.36-3.6 8.5-.98 9.47z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.43-4.92 8.43-9.94z" />
    </svg>
  );
}
