import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

export type AttachedProduct = {
  product_id: string;
  product_name: string;
  category: string;
  aust_l_number: string | null;
  price: number;
  vendor_name: string | null;
  dosage_notes: string;
};

export function ProductCard({ product }: { product: AttachedProduct }) {
  const price = Number(product.price).toFixed(2);
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-gold/40">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-gold">
          {product.category}
        </span>
        <span className="font-display text-2xl text-gold">${price}</span>
      </div>

      <h4 className="mt-3 font-display text-xl leading-tight text-foreground">
        {product.product_name}
      </h4>

      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        {product.aust_l_number && <p className="font-mono">{product.aust_l_number}</p>}
        {product.vendor_name && <p>by {product.vendor_name}</p>}
      </div>

      {product.dosage_notes && (
        <div className="mt-4 rounded-xl border border-violet/30 bg-violet/5 p-3 text-sm text-foreground/90">
          <p className="text-[10px] uppercase tracking-wider text-violet">Practitioner note</p>
          <p className="mt-1">{product.dosage_notes}</p>
        </div>
      )}

      <button
        onClick={() => toast.info("Checkout coming soon — Stripe integration in progress.")}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        style={{ marginTop: "1.25rem" }}
      >
        <ShoppingBag className="h-4 w-4" />
        Purchase medication
      </button>
    </article>
  );
}
