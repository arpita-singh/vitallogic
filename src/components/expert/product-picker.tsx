import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type CatalogProduct = {
  id: string;
  product_name: string;
  category: string;
  aust_l_number: string | null;
  price: number;
  vendor_name: string | null;
};

export type AttachedProduct = {
  product_id: string;
  product_name: string;
  category: string;
  aust_l_number: string | null;
  price: number;
  vendor_name: string | null;
  dosage_notes: string;
};

export function ProductPicker({
  value,
  onChange,
  disabled,
}: {
  value: AttachedProduct[];
  onChange: (next: AttachedProduct[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("certified_materia_medica")
        .select("id, product_name, category, aust_l_number, price, vendor_name")
        .eq("stock_status", true)
        .order("category", { ascending: true })
        .order("product_name", { ascending: true });
      if (cancelled) return;
      if (error) console.error(error);
      setProducts((data ?? []) as CatalogProduct[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIds = new Set(value.map((p) => p.product_id));
  const grouped = products.reduce<Record<string, CatalogProduct[]>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  const toggle = (p: CatalogProduct) => {
    if (selectedIds.has(p.id)) {
      onChange(value.filter((v) => v.product_id !== p.id));
    } else {
      onChange([
        ...value,
        {
          product_id: p.id,
          product_name: p.product_name,
          category: p.category,
          aust_l_number: p.aust_l_number,
          price: p.price,
          vendor_name: p.vendor_name,
          dosage_notes: "",
        },
      ]);
    }
  };

  const updateNotes = (id: string, notes: string) => {
    onChange(value.map((v) => (v.product_id === id ? { ...v, dosage_notes: notes } : v)));
  };

  const remove = (id: string) => onChange(value.filter((v) => v.product_id !== id));

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            disabled={disabled || loading}
            className="w-full justify-between border-border bg-background text-left text-sm font-normal"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4 text-gold" />
              {loading ? "Loading catalog…" : "Search marketplace products"}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by product name…" />
            <CommandList className="max-h-72">
              <CommandEmpty>No products found.</CommandEmpty>
              {Object.entries(grouped).map(([category, items]) => (
                <CommandGroup key={category} heading={category}>
                  {items.map((p) => {
                    const selected = selectedIds.has(p.id);
                    return (
                      <CommandItem
                        key={p.id}
                        value={`${p.product_name} ${p.aust_l_number ?? ""} ${p.vendor_name ?? ""}`}
                        onSelect={() => toggle(p)}
                        className="flex items-start gap-2"
                      >
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0 text-gold",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {p.product_name}
                            </span>
                            <span className="shrink-0 text-xs text-gold">
                              ${Number(p.price).toFixed(2)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                            {p.aust_l_number && (
                              <span className="rounded border border-border px-1 py-px font-mono">
                                {p.aust_l_number}
                              </span>
                            )}
                            {p.vendor_name && <span>{p.vendor_name}</span>}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">No marketplace products attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((p) => (
            <li key={p.product_id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{p.product_name}</p>
                    <span className="shrink-0 text-xs text-gold">${Number(p.price).toFixed(2)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-px text-gold">
                      {p.category}
                    </span>
                    {p.aust_l_number && (
                      <span className="font-mono">{p.aust_l_number}</span>
                    )}
                    {p.vendor_name && <span>{p.vendor_name}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(p.product_id)}
                  disabled={disabled}
                  aria-label="Remove product"
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                value={p.dosage_notes}
                onChange={(e) => updateNotes(p.product_id, e.target.value)}
                disabled={disabled}
                placeholder="Dosage / instructions for the patient (optional)"
                className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
