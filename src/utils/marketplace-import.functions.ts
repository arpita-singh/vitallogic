// Client helper for the `marketplace-import` edge function.
//
// Replaces the previous TanStack server-function transport, which failed with
// 401 because the Authorization header was not forwarded. supabase.functions
// .invoke() attaches the signed-in user's JWT automatically.
import { supabase } from "@/integrations/supabase/client";

export type MarketplaceImportResult = {
  ok: boolean;
  error?: string;
  source?: string;
  inserted: number;
  updated: number;
  skipped: number;
  total?: number;
};

export async function importMarketplaceProducts(args: {
  data: { source: "healthy_habitat" | "isha_life"; limit?: number };
}): Promise<MarketplaceImportResult> {
  const body = {
    source: args.data.source,
    limit: args.data.limit ?? 100,
  };
  const { data, error } = await supabase.functions.invoke("marketplace-import", {
    body,
  });
  if (error) {
    let message = error.message || "Import failed";
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const parsed = (await ctx.json()) as { error?: string } | undefined;
        if (parsed?.error) message = parsed.error;
      }
    } catch {
      /* ignore */
    }
    return { ok: false, error: message, inserted: 0, updated: 0, skipped: 0 };
  }
  return data as MarketplaceImportResult;
}
