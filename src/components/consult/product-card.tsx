import { ShoppingBag, ShieldCheck, ExternalLink, Sparkles, Leaf, Flame } from "lucide-react";
import { toast } from "sonner";
import { buildArtgSearchUrl } from "@/lib/tga";

export type AttachedProduct = {
  product_id: string;
  product_name: string;
  category: string;
  aust_l_number: string | null;
  price: number;
  vendor_name: string | null;
  dosage_notes: string;
  external_url?: string | null;
  artg_verified?: boolean;
  source_authority?: "clinical" | "traditional" | "consecrated" | null;
  snapshot_at?: string;
};

const AUTHORITY_META: Record<
  "clinical" | "traditional" | "consecrated",
  { label: string; Icon: typeof Sparkles; cls: string }
> = {
  clinical: { label: "Clinical", cls: "border-violet/40 bg-violet/10 text-violet", Icon: Sparkles },
  traditional: { label: "Traditional", cls: "border-gold/40 bg-gold/10 text-gold", Icon: Leaf },
  consecrated: {
    label: "Consecrated",
    cls: "border-orange-400/40 bg-orange-400/10 text-orange-300",
    Icon: Flame,
  },
};

export function ProductCard({ product }: { product: AttachedProduct }) {
  const price = Number(product.price).toFixed(2);
  const hasExternal = Boolean(product.external_url);
  const authority = product.source_authority ? AUTHORITY_META[product.source_authority] : null;
  const showArtg = product.artg_verified && product.aust_l_number;
  const tgaSearch = buildArtgSearchUrl(product.aust_l_number);
  const vendorLabel = product.vendor_name?.trim() || "partner store";

  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-gold/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-gold">
            {product.category}
          </span>
          {authority && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${authority.cls}`}
            >
              <authority.Icon className="h-3 w-3" />
              {authority.label}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="font-display text-2xl text-gold">${price}</span>
          {product.snapshot_at && (
            <span
              className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/70"
              title="Immutable snapshot of the catalog at the time this prescription was issued."
            >
              Catalog snapshot · {new Date(product.snapshot_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <h4 className="mt-3 font-display text-xl leading-tight text-foreground">
        {product.product_name}
      </h4>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {product.aust_l_number && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono">{product.aust_l_number}</span>
            {showArtg && tgaSearch && (
              <a
                href={tgaSearch}
                target="_blank"
                rel="noopener noreferrer"
                title="Listed on the Australian Register of Therapeutic Goods. Not TGA approved — listed products are TGA-notified, not clinically evaluated."
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20"
              >
                <ShieldCheck className="h-3 w-3" />
                ARTG Listed
              </a>
            )}
          </div>
        )}
        {product.vendor_name && <p>by {product.vendor_name}</p>}
      </div>

      {product.dosage_notes && (
        <div className="mt-4 rounded-xl border border-violet/30 bg-violet/5 p-3 text-sm text-foreground/90">
          <p className="text-[10px] uppercase tracking-wider text-violet">Practitioner note</p>
          <p className="mt-1">{product.dosage_notes}</p>
        </div>
      )}

      <div className="mt-auto pt-5">
        {hasExternal ? (
          <>
            <a
              href={product.external_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" />
              Buy at {vendorLabel}
            </a>
            <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground">
              External source · VitalLogic doesn't control third-party claims.
            </p>
          </>
        ) : (
          <button
            onClick={() => toast.info("Checkout coming soon — Stripe integration in progress.")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4" />
            Purchase medication
          </button>
        )}
      </div>
    </article>
  );
}
