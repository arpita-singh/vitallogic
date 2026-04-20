// Marketplace ingestion edge function.
//
// Replaces the TanStack server-function transport for /expert/catalog imports.
// The previous server-fn path failed with 401 because the Authorization header
// was not forwarded from the client. supabase.functions.invoke() automatically
// attaches the signed-in user's JWT, which we verify here.
//
// Sources:
//   - isha_life: Shopify /products.json (public feed)
//   - healthy_habitat: no public feed (returns clear message)
//
// verify_jwt is disabled in supabase/config.toml — we authenticate ourselves
// so we can return structured JSON errors rather than raw 401 Responses.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const InputSchema = z.object({
  source: z.enum(["healthy_habitat", "isha_life"]),
  limit: z.number().int().min(1).max(250).default(100),
});

const MARKETPLACE_SOURCES = {
  healthy_habitat: {
    label: "Healthy Habitat Market",
    host: "healthyhabitatmarket.com",
    productsUrl: null as ((limit: number) => string) | null,
    productPageUrl: (handle: string) =>
      `https://healthyhabitatmarket.com/products/${handle}`,
    defaultSourceAuthority: "clinical",
  },
  isha_life: {
    label: "Isha Life AU",
    host: "ishalife.com.au",
    productsUrl: (limit: number) =>
      `https://ishalife.com.au/products.json?limit=${limit}`,
    productPageUrl: (handle: string) =>
      `https://ishalife.com.au/products/${handle}`,
    defaultSourceAuthority: "consecrated",
  },
} as const;

type ShopifyVariant = { id?: number; price?: string; available?: boolean };
type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  variants?: ShopifyVariant[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const raw = await req.json().catch(() => null);
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) {
      return json(
        { ok: false, error: "Invalid request", inserted: 0, updated: 0, skipped: 0 },
        400,
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller via JWT.
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(
        { ok: false, error: "Sign in as an expert to import.", inserted: 0, updated: 0, skipped: 0 },
        200,
      );
    }
    const token = authHeader.slice("Bearer ".length);
    const { data: userResult } = await admin.auth.getUser(token);
    const userId = userResult?.user?.id;
    if (!userId) {
      return json(
        { ok: false, error: "Session expired. Please sign in again.", inserted: 0, updated: 0, skipped: 0 },
        200,
      );
    }

    // Role gate.
    const { data: roles, error: rolesErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) {
      console.error("role lookup failed", rolesErr);
      return json(
        { ok: false, error: "Could not verify role.", inserted: 0, updated: 0, skipped: 0 },
        200,
      );
    }
    const isPrivileged = (roles ?? []).some(
      (r) => r.role === "expert" || r.role === "admin",
    );
    if (!isPrivileged) {
      return json(
        { ok: false, error: "Only experts or admins can import.", inserted: 0, updated: 0, skipped: 0 },
        200,
      );
    }

    const cfg = MARKETPLACE_SOURCES[parsed.data.source];

    if (cfg.productsUrl === null) {
      return json({
        ok: false,
        error: `${cfg.label} does not expose a public product feed. A manual partner connector is required for this source.`,
        source: cfg.label,
        inserted: 0,
        updated: 0,
        skipped: 0,
      });
    }

    let products: ShopifyProduct[] = [];
    try {
      const res = await fetch(cfg.productsUrl(parsed.data.limit), {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; VitalLogicBot/1.0; +https://vitallogic.lovable.app)",
        },
      });
      if (!res.ok) {
        return json({
          ok: false,
          error: `Partner returned ${res.status}. Public feed may be unavailable.`,
          source: cfg.label,
          inserted: 0,
          updated: 0,
          skipped: 0,
        });
      }
      const text = await res.text();
      try {
        const parsedJson = JSON.parse(text) as { products?: ShopifyProduct[] };
        products = Array.isArray(parsedJson.products) ? parsedJson.products : [];
      } catch {
        return json({
          ok: false,
          error: `Partner returned non-JSON (${text.slice(0, 60)}…).`,
          source: cfg.label,
          inserted: 0,
          updated: 0,
          skipped: 0,
        });
      }
    } catch (err) {
      console.error("marketplace fetch failed", err);
      return json({
        ok: false,
        error: "Could not reach the partner marketplace. Try again later.",
        source: cfg.label,
        inserted: 0,
        updated: 0,
        skipped: 0,
      });
    }

    if (products.length === 0) {
      return json({
        ok: true,
        source: cfg.label,
        inserted: 0,
        updated: 0,
        skipped: 0,
        total: 0,
      });
    }

    const externalIds = products.map((p) => String(p.id));
    const { data: existing, error: existingErr } = await admin
      .from("certified_materia_medica")
      .select("id, import_external_id, price, stock_status")
      .eq("import_source", cfg.host)
      .in("import_external_id", externalIds);
    if (existingErr) {
      console.error("existing lookup failed", existingErr);
      return json({
        ok: false,
        error: "Could not check for existing rows.",
        source: cfg.label,
        inserted: 0,
        updated: 0,
        skipped: 0,
      });
    }

    const existingByExtId = new Map<
      string,
      { id: string; price: number; stock_status: boolean }
    >();
    for (const row of existing ?? []) {
      if (row.import_external_id) {
        existingByExtId.set(row.import_external_id, {
          id: row.id as string,
          price: Number(row.price),
          stock_status: row.stock_status as boolean,
        });
      }
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const p of products) {
      const v0 = p.variants?.[0];
      const price = v0?.price ? Number(v0.price) : 0;
      const stock = Boolean(v0?.available);
      const extId = String(p.id);
      const existingRow = existingByExtId.get(extId);

      if (existingRow) {
        if (existingRow.price === price && existingRow.stock_status === stock) {
          skipped += 1;
          continue;
        }
        const { error } = await admin
          .from("certified_materia_medica")
          .update({ price, stock_status: stock })
          .eq("id", existingRow.id);
        if (error) {
          console.error("update failed", error);
          skipped += 1;
        } else {
          updated += 1;
        }
        continue;
      }

      const { error } = await admin.from("certified_materia_medica").insert({
        product_name: p.title,
        category: p.product_type?.trim() || "uncategorised",
        vendor_name: p.vendor ?? cfg.label,
        price,
        stock_status: stock,
        external_url: cfg.productPageUrl(p.handle),
        artg_verified: false,
        source_authority: cfg.defaultSourceAuthority,
        import_status: "pending_review",
        import_source: cfg.host,
        import_external_id: extId,
      });
      if (error) {
        console.error("insert failed", error, p.title);
        skipped += 1;
      } else {
        inserted += 1;
      }
    }

    return json({
      ok: true,
      source: cfg.label,
      inserted,
      updated,
      skipped,
      total: products.length,
    });
  } catch (e) {
    console.error("marketplace-import error", e);
    return json(
      { ok: false, error: "Internal server error", inserted: 0, updated: 0, skipped: 0 },
      500,
    );
  }
});
