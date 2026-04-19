import { Plus, X } from "lucide-react";
import type { Modality } from "@/components/consult/modality-badge";

export type Product = { name: string; form?: string; dosage?: string; notes?: string };
export type Recommendation = {
  title: string;
  modality: Modality;
  rationale: string;
  suggested_products: Product[];
  safety_notes: string;
  citations: string[];
};
export type RxData = {
  summary: string;
  red_flags: string[];
  escalate: boolean;
  recommendations: Recommendation[];
};

const MODALITIES: Modality[] = [
  "ayurveda",
  "western_naturopathy",
  "indigenous",
  "plant_medicine",
  "lifestyle",
];

export function RecommendationEditor({
  value,
  onChange,
  disabled,
}: {
  value: RxData;
  onChange: (next: RxData) => void;
  disabled?: boolean;
}) {
  const update = (patch: Partial<RxData>) => onChange({ ...value, ...patch });

  const updateRec = (i: number, patch: Partial<Recommendation>) => {
    const next = value.recommendations.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    update({ recommendations: next });
  };

  const updateProduct = (ri: number, pi: number, patch: Partial<Product>) => {
    const rec = value.recommendations[ri];
    const products = rec.suggested_products.map((p, idx) =>
      idx === pi ? { ...p, ...patch } : p,
    );
    updateRec(ri, { suggested_products: products });
  };

  const addProduct = (ri: number) => {
    const rec = value.recommendations[ri];
    updateRec(ri, {
      suggested_products: [...rec.suggested_products, { name: "", form: "", dosage: "", notes: "" }],
    });
  };

  const removeProduct = (ri: number, pi: number) => {
    const rec = value.recommendations[ri];
    updateRec(ri, {
      suggested_products: rec.suggested_products.filter((_, idx) => idx !== pi),
    });
  };

  const updateRedFlag = (idx: number, txt: string) => {
    const next = value.red_flags.map((rf, i) => (i === idx ? txt : rf));
    update({ red_flags: next });
  };
  const addRedFlag = () => update({ red_flags: [...value.red_flags, ""] });
  const removeRedFlag = (idx: number) =>
    update({ red_flags: value.red_flags.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-6">
      {/* Top-level */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-gold">Summary</span>
          <textarea
            value={value.summary}
            onChange={(e) => update({ summary: e.target.value })}
            disabled={disabled}
            rows={3}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
          />
        </label>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-destructive">Red flags</span>
            <button
              type="button"
              onClick={addRedFlag}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          {value.red_flags.length === 0 ? (
            <p className="text-xs text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-2">
              {value.red_flags.map((rf, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input
                    value={rf}
                    onChange={(e) => updateRedFlag(i, e.target.value)}
                    disabled={disabled}
                    className="flex-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-sm text-foreground focus:border-destructive focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => removeRedFlag(i)}
                    disabled={disabled}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-40"
                    aria-label="Remove red flag"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.escalate}
            onChange={(e) => update({ escalate: e.target.checked })}
            disabled={disabled}
            className="h-4 w-4 rounded border-border bg-background"
          />
          <span className="text-sm text-foreground">Escalate to senior practitioner</span>
        </label>
      </div>

      {/* Recommendations */}
      {value.recommendations.map((rec, ri) => (
        <article key={ri} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-lg text-foreground">Recommendation {ri + 1}</h3>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Title</span>
              <input
                value={rec.title}
                onChange={(e) => updateRec(ri, { title: e.target.value })}
                disabled={disabled}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Modality</span>
              <select
                value={rec.modality}
                onChange={(e) => updateRec(ri, { modality: e.target.value as Modality })}
                disabled={disabled}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
              >
                {MODALITIES.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Rationale</span>
              <textarea
                value={rec.rationale}
                onChange={(e) => updateRec(ri, { rationale: e.target.value })}
                disabled={disabled}
                rows={3}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-gold">Products</span>
                <button
                  type="button"
                  onClick={() => addProduct(ri)}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" /> Add product
                </button>
              </div>
              {rec.suggested_products.length === 0 ? (
                <p className="text-xs text-muted-foreground">No products yet.</p>
              ) : (
                <ul className="space-y-3">
                  {rec.suggested_products.map((p, pi) => (
                    <li
                      key={pi}
                      className="rounded-xl border border-border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <input
                          value={p.name}
                          onChange={(e) => updateProduct(ri, pi, { name: e.target.value })}
                          disabled={disabled}
                          placeholder="Product name"
                          className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm font-medium text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => removeProduct(ri, pi)}
                          disabled={disabled}
                          className="rounded-md p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-40"
                          aria-label="Remove product"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          value={p.form ?? ""}
                          onChange={(e) => updateProduct(ri, pi, { form: e.target.value })}
                          disabled={disabled}
                          placeholder="Form (e.g. tea)"
                          className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
                        />
                        <input
                          value={p.dosage ?? ""}
                          onChange={(e) => updateProduct(ri, pi, { dosage: e.target.value })}
                          disabled={disabled}
                          placeholder="Dosage"
                          className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
                        />
                      </div>
                      <input
                        value={p.notes ?? ""}
                        onChange={(e) => updateProduct(ri, pi, { notes: e.target.value })}
                        disabled={disabled}
                        placeholder="Notes"
                        className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-violet">Safety notes</span>
              <textarea
                value={rec.safety_notes}
                onChange={(e) => updateRec(ri, { safety_notes: e.target.value })}
                disabled={disabled}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Citations (one per line)
              </span>
              <textarea
                value={rec.citations.join("\n")}
                onChange={(e) =>
                  updateRec(ri, {
                    citations: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  })
                }
                disabled={disabled}
                rows={3}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-gold focus:outline-none disabled:opacity-60"
              />
            </label>
          </div>
        </article>
      ))}
    </div>
  );
}
