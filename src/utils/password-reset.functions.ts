import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Flip to false for the industry-standard (safer) generic response that
// hides whether an email is registered. The user explicitly asked for
// the explicit "not_registered" message, so default is true.
const REVEAL_EMAIL_EXISTENCE = true;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// In-memory per-IP rate limit. Resets on cold start; good enough for v1.
const ipHits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  origin: z.string().url().max(2048),
});

export type PasswordResetStatus = "sent" | "not_registered" | "rate_limited" | "error";

async function emailExists(email: string): Promise<boolean> {
  // Supabase admin API doesn't expose a direct "find by email" call in a
  // stable, typed way across versions. Page through listUsers (max
  // 1000/page). Cap at 10 pages = 10k users, which is plenty for this
  // project. For larger user bases, swap this for a direct query against
  // auth.users via the service-role client.
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (listErr) throw listErr;
    if (list.users.some((u) => u.email?.toLowerCase() === target)) return true;
    if (list.users.length < 1000) break;
  }
  return false;
}

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ status: PasswordResetStatus; message?: string }> => {
    // Rate limit per IP (best-effort)
    let ip = "unknown";
    try {
      ip =
        getRequestIP({ xForwardedFor: true }) ||
        getRequestHeader("x-forwarded-for") ||
        "unknown";
    } catch {
      // ignore — rate limiting is best-effort
    }
    if (!checkRateLimit(ip)) {
      return {
        status: "rate_limited",
        message: "Too many attempts. Please try again in a few minutes.",
      };
    }

    try {
      const exists = await emailExists(data.email);

      if (!exists) {
        if (REVEAL_EMAIL_EXISTENCE) {
          return { status: "not_registered" };
        }
        // Secure mode: pretend we sent it.
        return { status: "sent" };
      }

      const redirectTo = `${data.origin.replace(/\/$/, "")}/reset-password`;
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
        redirectTo,
      });
      if (error) {
        console.error("resetPasswordForEmail error:", error);
        return { status: "error", message: "Could not send the recovery email. Please try again." };
      }
      return { status: "sent" };
    } catch (err) {
      console.error("requestPasswordReset failed:", err);
      return { status: "error", message: "Something went wrong. Please try again." };
    }
  });