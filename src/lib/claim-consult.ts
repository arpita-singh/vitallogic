import { supabase } from "@/integrations/supabase/client";

const KEY = "pendingConsultId";

export function rememberPendingConsult(consultId: string) {
  try {
    sessionStorage.setItem(KEY, consultId);
  } catch {
    /* ignore */
  }
}

export function getPendingConsult(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingConsult() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
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
  clearPendingConsult();
  if (error) {
    console.error("claimPendingConsult error", error);
    return null;
  }
  return data?.id ?? consultId;
}
