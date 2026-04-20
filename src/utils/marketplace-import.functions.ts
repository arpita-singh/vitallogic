import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Marketplace ingestion v1.
 * Pulls a partner store's public Shopify products.json feed and stages rows
 * into certified_materia_medica with import_status = 'pending_review'.
 * Re-runs UPDATE price + stock for already-imported rows (price/stock tracker).
 */

const MARKETPLACE_SOURCES = {
  healthy_habitat: {
    label: "Healthy Habitat Market",
    host: "healthyhabitatmarket.com",
    // Healthy Habitat is an Elementor/WordPress site without a public product
    // API (no Shopify /products.json, no WooCommerce Store API, no WP product
    // CPT). Ingestion requires a manual partner connector — surface a clean
    // error instead of pretending a feed exists.
    productsUrl: null,
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

type MarketplaceKey = keyof typeof MARKETPLACE_SOURCES;

const InputSchema = z.object({
  source: z.enum(["healthy_habitat", "isha_life"]),
  limit: z.number().int().min(1).max(250).default(100),
});

// Shape returned by Shopify /products.json — only fields we use.
type ShopifyVariant = {
  id?: number;
  price?: string;
  available?: boolean;
};
type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  product_type?: string;
  variants?: ShopifyVariant[];
};

export const importMarketplaceProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the caller is an expert or admin. RLS would already block writes
    // for regular users but we want a clean 403 instead of a silent skip.
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) {
      return {
        ok: false as const,
        error: "Could not verify role.",
        inserted: 0,
        updated: 0,
        skipped: 0,
      };
    }
    const isPrivileged = (roles ?? []).some(
      (r) => r.role === "expert" || r.role === "admin",
    );
    if (!isPrivileged) {
      return {
        ok: false as const,
        error: "Only experts or admins can import marketplace products.",
        inserted: 0,
        updated: 0,
        skipped: 0,
      };
    }

    const cfg = MARKETPLACE_SOURCES[data.source as MarketplaceKey];

    // Sources without a public product feed (e.g. Elementor sites) bail early
    // with a clear message instead of erroring inside fetch().
    if (cfg.productsUrl === null) {
      return {
        ok: false as const,
        error: `${cfg.label} does not expose a public product feed. A manual partner connector is required for this source.`,
        inserted: 0,
        updated: 0,
        skipped: 0,
      };
    }

    let products: ShopifyProduct[] = [];
    try {
      const res = await fetch(cfg.productsUrl(data.limit), {
        headers: {
          Accept: "application/json",
          // Some Shopify storefronts (and edge/CDN layers) reject requests
          // that lack a real User-Agent — bare Worker fetches fail without it.
          "User-Agent":
            "Mozilla/5.0 (compatible; VitalLogicBot/1.0; +https://vitallogic.lovable.app)",
        },
      });
      if (!res.ok) {
        return {
          ok: false as const,
          error: `Partner returned ${res.status}. The site may not expose a public products.json feed — fall back to a connector for this source.`,
          inserted: 0,
          updated: 0,
          skipped: 0,
        };
      }
      const text = await res.text();
      let json: { products?: ShopifyProduct[] };
      try {
        json = JSON.parse(text);
      } catch {
        return {
          ok: false as const,
          error: `Partner returned non-JSON (${text.slice(0, 60)}…). Public feed unavailable.`,
          inserted: 0,
          updated: 0,
          skipped: 0,
        };
      }
      products = Array.isArray(json.products) ? json.products : [];
    } catch (err) {
      console.error("marketplace fetch failed", err);
      return {
        ok: false as const,
        error: "Could not reach the partner marketplace. Try again later.",
        inserted: 0,
        updated: 0,
        skipped: 0,
      };
    }

    if (products.length === 0) {
      return { ok: true as const, inserted: 0, updated: 0, skipped: 0 };
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Pre-fetch existing rows for this source to decide insert vs update.
    const externalIds = products.map((p) => String(p.id));
    const { data: existing, error: existingErr } = await supabase
      .from("certified_materia_medica")
      .select("id, import_external_id, price, stock_status")
      .eq("import_source", cfg.host)
      .in("import_external_id", externalIds);
    if (existingErr) {
      console.error(existingErr);
      return {
        ok: false as const,
        error: "Could not check for existing rows.",
        inserted: 0,
        updated: 0,
        skipped: 0,
      };
    }
    const existingByExtId = new Map<
      string,
      { id: string; price: number; stock_status: boolean }
    >();
    for (const row of existing ?? []) {
      if (row.import_external_id) {
        existingByExtId.set(row.import_external_id, {
          id: row.id,
          price: Number(row.price),
          stock_status: row.stock_status,
        });
      }
    }

    for (const p of products) {
      const v0 = p.variants?.[0];
      const price = v0?.price ? Number(v0.price) : 0;
      const stock = Boolean(v0?.available);
      const extId = String(p.id);
      const existingRow = existingByExtId.get(extId);

      if (existingRow) {
        // Refresh price + stock only — do NOT clobber expert-curated fields.
        if (
          existingRow.price === price &&
          existingRow.stock_status === stock
        ) {
          skipped += 1;
          continue;
        }
        const { error } = await supabase
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

      // New row → stage for expert review.
      const { error } = await supabase.from("certified_materia_medica").insert({
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

    return {
      ok: true as const,
      source: cfg.label,
      inserted,
      updated,
      skipped,
      total: products.length,
    };
  });
