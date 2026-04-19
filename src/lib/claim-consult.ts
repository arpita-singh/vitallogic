import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "pendingConsultId";
const LEGACY_LOCAL_KEY = "vl_consult_id";

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeRemove(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function rememberPendingConsult(consultId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, consultId);
  } catch {
    /* ignore */
  }
  // Also mirror to localStorage so a different tab / hard refresh can recover it.
  try {
    window.localStorage.setItem(LEGACY_LOCAL_KEY, consultId);
  } catch {
    /* ignore */
  }
}

/**
 * Read the most recent pending consult id from any storage we have used historically.
 * Checks sessionStorage first (current canonical location), then localStorage
 * (legacy / cross-tab fallback).
 */
export function getPendingConsult(): string | null {
  if (typeof window === "undefined") return null;
  return (
    safeGet(window.sessionStorage, SESSION_KEY) ??
    safeGet(window.localStorage, LEGACY_LOCAL_KEY)
  );
}

export function clearPendingConsult() {
  if (typeof window === "undefined") return;
  safeRemove(window.sessionStorage, SESSION_KEY);
  safeRemove(window.localStorage, LEGACY_LOCAL_KEY);
}

/**
 * Claim a previously-anonymous consult for the now-authenticated user.
 * Safe to call after sign-in / sign-up / OAuth callback.
 * Returns the claimed consultId (or null if nothing to claim / failed).
 */
export async function claimPendingConsult(userId: string): Promise<string | null> {
  const consultId = getPendingConsult();
  if (!consultId) return null;
  const { data, error } = await supabase
    .from("consults")
    .update({ user_id: userId })
    .eq("id", consultId)
    .is("user_id", null)
    .select("id")
    .maybeSingle();
  // Always clear both keys so we never re-attempt with a stale id.
  clearPendingConsult();
  if (error) {
    console.error("claimPendingConsult error", error);
    return null;
  }
  // If `data` is null the consult was already claimed (by this user or another),
  // but we still return the id so callers can deep-link to /result if it now belongs to us.
  return data?.id ?? consultId;
}

/**
 * Attempt to claim a specific consult id for the authenticated user.
 * Used as a self-healing recovery on the result page when ownership is missing.
 */
export async function claimSpecificConsult(
  userId: string,
  consultId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("consults")
    .update({ user_id: userId })
    .eq("id", consultId)
    .is("user_id", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("claimSpecificConsult error", error);
    return false;
  }
  // Clear any pending pointer that matches this consult.
  if (getPendingConsult() === consultId) clearPendingConsult();
  return !!data;
}
