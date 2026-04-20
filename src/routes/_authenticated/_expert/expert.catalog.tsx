import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Check, X, ExternalLink } from "lucide-react";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { importMarketplaceProducts } from "@/utils/marketplace-import.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_expert/expert/catalog")({
  head: () => ({
    meta: [{ title: "Catalog review — Vital Logic" }],
  }),
  component: CatalogReview,
});

type PendingRow = {
  id: string;
  product_name: string;
  category: string;
  vendor_name: string | null;
  price: number;
  stock_status: boolean;
  external_url: string | null;
  aust_l_number: string | null;
  artg_verified: boolean;
  source_authority: string | null;
  description: string | null;
  import_source: string | null;
  created_at: string;
};

type EditState = {
  category: string;
  source_authority: string;
  aust_l_number: string;
  artg_verified: boolean;
  description: string;
};

const SOURCE_AUTHORITIES = ["clinical", "traditional", "consecrated"] as const;

function CatalogReview() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("certified_materia_medica")
      .select(
        "id, product_name, category, vendor_name, price, stock_status, external_url, aust_l_number, artg_verified, source_authority, description, import_source, created_at",
      )
      .eq("import_status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error(error);
      toast.error("Could not load pending products.");
      setRows([]);
    } else {
      const list = (data ?? []) as PendingRow[];
      setRows(list);
      const init: Record<string, EditState> = {};
      for (const r of list) {
        init[r.id] = {
          category: r.category,
          source_authority: r.source_authority ?? "clinical",
          aust_l_number: r.aust_l_number ?? "",
          artg_verified: r.artg_verified,
          description: r.description ?? "",
        };
      }
      setEdits(init);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const runImport = async () => {
    setImporting(true);
    try {
      const result = await importMarketplaceProducts({
        data: { source: "healthy_habitat", limit: 100 },
      });
      if (!result.ok) {
        toast.error(result.error ?? "Import failed.");
      } else {
        toast.success(
          `${result.source}: ${result.inserted} new · ${result.updated} updated · ${result.skipped} unchanged`,
        );
        setLastSync(new Date().toISOString());
        await load();
      }
    } catch (err) {
      console.error(err);
      toast.error("Import failed unexpectedly.");
    } finally {
      setImporting(false);
    }
  };

  const updateEdit = (id: string, patch: Partial<EditState>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const approve = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    if (!e.category.trim() || e.category === "uncategorised") {
      toast.error("Set a real category before approving.");
      return;
    }
    setSavingId(id);
    const { error } = await supabase
      .from("certified_materia_medica")
      .update({
        category: e.category.trim(),
        source_authority: e.source_authority,
        aust_l_number: e.aust_l_number.trim() || null,
        artg_verified: e.artg_verified,
        description: e.description.trim() || null,
        import_status: "live",
      })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      console.error(error);
      toast.error("Could not approve.");
    } else {
      toast.success("Approved — now live in catalog.");
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const reject = async (id: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from("certified_materia_medica")
      .update({ import_status: "rejected" })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      console.error(error);
      toast.error("Could not reject.");
    } else {
      toast.success("Rejected.");
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  };

  return (
    <Section className="py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <Link
              to="/expert"
              search={{ filter: "pending" }}
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-gold"
            >
              ← Back to queue
            </Link>
            <h1 className="mt-2 font-display text-4xl text-foreground md:text-5xl">
              Catalog <span className="text-gradient-gold">review</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Imported partner products land here as drafts. Curate, then approve to
              expose them in patient prescriptions.
            </p>
          </div>
          <Button
            onClick={() => void runImport()}
            disabled={importing}
            variant="outline"
            className="shrink-0 border-gold/50 text-gold hover:bg-gold/10"
          >
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Import from Healthy Habitat Market
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
          <span>
            {rows.length} {rows.length === 1 ? "product" : "products"} awaiting review
          </span>
          {lastSync && (
            <>
              <span>·</span>
              <span>Last sync {new Date(lastSync).toLocaleTimeString()}</span>
            </>
          )}
        </div>

        <div className="mt-8 space-y-3">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">
              Loading staging area…
            </p>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
              <p className="font-display text-2xl text-foreground">All clear.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                No products awaiting review. Click "Import" above to pull the partner
                catalog.
              </p>
            </div>
          ) : (
            rows.map((r) => {
              const e = edits[r.id];
              if (!e) return null;
              const saving = savingId === r.id;
              return (
                <article
                  key={r.id}
                  className={cn(
                    "rounded-2xl border border-border bg-surface/50 p-5",
                    saving && "opacity-60",
                  )}
                >
                  <header className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="truncate font-display text-lg text-foreground">
                          {r.product_name}
                        </h3>
                        <span className="text-sm text-gold">
                          ${Number(r.price).toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {r.vendor_name && <span>{r.vendor_name}</span>}
                        <span>·</span>
                        <span>{r.import_source}</span>
                        {r.external_url && (
                          <a
                            href={r.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> view on partner
                          </a>
                        )}
                        <span>·</span>
                        <span
                          className={
                            r.stock_status ? "text-emerald-400" : "text-destructive"
                          }
                        >
                          {r.stock_status ? "in stock" : "out of stock"}
                        </span>
                      </p>
                    </div>
                  </header>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Category
                      </span>
                      <input
                        value={e.category}
                        onChange={(ev) =>
                          updateEdit(r.id, { category: ev.target.value })
                        }
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Source authority
                      </span>
                      <select
                        value={e.source_authority}
                        onChange={(ev) =>
                          updateEdit(r.id, { source_authority: ev.target.value })
                        }
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                      >
                        {SOURCE_AUTHORITIES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        AUST L number (optional)
                      </span>
                      <input
                        value={e.aust_l_number}
                        onChange={(ev) =>
                          updateEdit(r.id, { aust_l_number: ev.target.value })
                        }
                        placeholder="e.g. AUST L 123456"
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground focus:border-gold focus:outline-none"
                      />
                    </label>
                    <label className="mt-6 inline-flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={e.artg_verified}
                        onChange={(ev) =>
                          updateEdit(r.id, { artg_verified: ev.target.checked })
                        }
                        className="h-4 w-4 rounded border-border bg-background text-gold focus:ring-gold"
                      />
                      ARTG Listed (verified manually)
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Description (optional)
                      </span>
                      <textarea
                        value={e.description}
                        onChange={(ev) =>
                          updateEdit(r.id, { description: ev.target.value })
                        }
                        rows={2}
                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                      />
                    </label>
                  </div>

                  <footer className="mt-4 flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void reject(r.id)}
                      disabled={saving}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="mr-1 h-4 w-4" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void approve(r.id)}
                      disabled={saving}
                      className="bg-gold text-background hover:bg-gold/90"
                    >
                      <Check className="mr-1 h-4 w-4" /> Approve & publish
                    </Button>
                  </footer>
                </article>
              );
            })
          )}
        </div>
      </div>
    </Section>
  );
}
