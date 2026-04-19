// Thin client for the `consult-access` edge function. We use this instead of
// the TanStack server functions in `consult-server.ts` because those run in
// the Worker SSR runtime, which does not have SUPABASE_SERVICE_ROLE_KEY.
// Edge functions do — and `supabase.functions.invoke()` automatically attaches
// the user's session JWT as Authorization for signed-in callers.
import { supabase } from "@/integrations/supabase/client";

type Json = Record<string, unknown>;

async function call<T = Json>(body: Json): Promise<T> {
  const { data, error } = await supabase.functions.invoke("consult-access", { body });
  if (error) {
    // The Functions client throws a generic FunctionsHttpError for non-2xx.
    // Try to surface the server's error message if present.
    let message = error.message || "Request failed";
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx && typeof (ctx as Response).json === "function") {
        const parsed = (await (ctx as Response).json()) as { error?: string } | undefined;
        if (parsed?.error) message = parsed.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return data as T;
}

export type ConsultReadResult = {
  consult: {
    id: string;
    intake: { contactEmail?: string } & Record<string, unknown>;
    user_id: string | null;
    status: string;
  } | null;
  messages: { role: "user" | "assistant" | "system"; content: string; created_at: string }[];
  prescriptions: { id: string; status: string }[];
  ownerUserId: string | null;
};

export function readConsult(consultId: string, anonToken?: string) {
  return call<ConsultReadResult>({ action: "read", consultId, anonToken });
}

export function saveConsultContact(args: {
  consultId: string;
  contactEmail: string;
  contactName?: string;
  anonToken?: string;
}) {
  return call<{ ok: true }>({ action: "saveContact", ...args });
}

export function claimConsultRequest(consultId: string, anonToken?: string) {
  return call<{ ok: boolean; error?: string }>({ action: "claim", consultId, anonToken });
}

export function unlockEducationRequest(consultId: string) {
  return call<{ ok: true }>({ action: "unlock", consultId });
}
