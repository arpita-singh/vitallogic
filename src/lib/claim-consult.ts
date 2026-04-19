import { claimConsult } from "@/lib/consult-server";

const SESSION_KEY = "pendingConsultV2";
const LEGACY_SESSION_ID_KEY = "pendingConsultId";
const LEGACY_LOCAL_ID_KEY = "vl_consult_id";

type Pending = { consultId: string; anonToken: string };

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemove(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Persist {consultId, anonToken} so that:
 *  - the same browser tab can keep talking to the consult (sessionStorage),
 *  - and a different tab / hard refresh can also recover it (localStorage).
 *
 * The anonToken is the only thing that proves ownership of an anonymous
 * consult — it must travel with the consultId everywhere we read/write.
 */
export function rememberPendingConsult(consultId: string, anonToken?: string) {
  if (typeof window === "undefined") return;
  // If no token provided, we may be re-stashing an existing claim attempt
  // (e.g. signed-in user landing on a /result page they don't own yet).
  // Preserve any token we already have for this consult.
  const existing = getPendingConsult();
  const token =
    anonToken ??
    (existing?.consultId === consultId ? existing.anonToken : "");
  const payload = JSON.stringify({ consultId, anonToken: token });
  safeSet(window.sessionStorage, SESSION_KEY, payload);
  safeSet(window.localStorage, SESSION_KEY, payload);
}

/**
 * Read the most recent pending consult + token from storage. Falls back to
 * legacy id-only entries (token will be empty in that case).
 */
export function getPendingConsult(): Pending | null {
  if (typeof window === "undefined") return null;
  const raw =
    safeGet(window.sessionStorage, SESSION_KEY) ??
    safeGet(window.localStorage, SESSION_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Pending;
      if (parsed?.consultId) return parsed;
    } catch {
      /* fall through to legacy */
    }
  }
  // Legacy fallback: id-only, no token (predates the security fix).
  const legacyId =
    safeGet(window.sessionStorage, LEGACY_SESSION_ID_KEY) ??
    safeGet(window.localStorage, LEGACY_LOCAL_ID_KEY);
  if (legacyId) return { consultId: legacyId, anonToken: "" };
  return null;
}

/** Convenience for callers that just need the id. */
export function getPendingConsultId(): string | null {
  return getPendingConsult()?.consultId ?? null;
}

/** Convenience for callers that need the token for a known consult. */
export function getAnonTokenFor(consultId: string): string | undefined {
  const p = getPendingConsult();
  if (!p || p.consultId !== consultId) return undefined;
  return p.anonToken || undefined;
}

export function clearPendingConsult() {
  if (typeof window === "undefined") return;
  safeRemove(window.sessionStorage, SESSION_KEY);
  safeRemove(window.localStorage, SESSION_KEY);
  safeRemove(window.sessionStorage, LEGACY_SESSION_ID_KEY);
  safeRemove(window.localStorage, LEGACY_LOCAL_ID_KEY);
}

/**
 * Claim a previously-anonymous consult for the now-authenticated user.
 * Sends the anon token if we have one so the server can verify ownership.
 */
export async function claimPendingConsult(_userId: string): Promise<string | null> {
  const pending = getPendingConsult();
  if (!pending) return null;
  try {
    await claimConsult({
      data: { consultId: pending.consultId, anonToken: pending.anonToken || undefined },
    });
  } catch (e) {
    console.error("claimPendingConsult error", e);
  } finally {
    clearPendingConsult();
  }
  return pending.consultId;
}

/**
 * Attempt to claim a specific consult id for the authenticated user.
 * Used as a self-healing recovery on the result page.
 */
export async function claimSpecificConsult(
  _userId: string,
  consultId: string,
): Promise<boolean> {
  const token = getAnonTokenFor(consultId);
  try {
    const res = await claimConsult({ data: { consultId, anonToken: token } });
    if (getPendingConsultId() === consultId) clearPendingConsult();
    return !!res?.ok;
  } catch (e) {
    console.error("claimSpecificConsult error", e);
    return false;
  }
}
