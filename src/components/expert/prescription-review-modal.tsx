import { CheckCircle2, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalityBadge } from "@/components/consult/modality-badge";
import { ProductCard } from "@/components/consult/product-card";
import type { RxData } from "@/components/expert/recommendation-editor";
import type { AttachedProduct } from "@/components/expert/product-picker";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: RxData;
  attachedProducts: AttachedProduct[];
  reviewerNotes: string;
  patientName: string;
  onConfirm: () => void;
  busy: boolean;
};

export function PrescriptionReviewModal({
  open,
  onOpenChange,
  data,
  attachedProducts,
  reviewerNotes,
  patientName,
  onConfirm,
  busy,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-surface px-6 py-4">
          <DialogTitle className="font-display text-2xl text-foreground">
            Review &amp; approve
          </DialogTitle>
          <DialogDescription>
            This is exactly what {patientName || "the patient"} will see once approved.
          </DialogDescription>
        </DialogHeader>

        {/* Patient preview */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
          <div className="mb-3 flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gold w-fit">
            <Sparkles className="h-3 w-3" /> Patient preview
          </div>

          <div className="flex items-center gap-2 text-gold">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-xs uppercase tracking-[0.25em]">Approved by a practitioner</span>
          </div>
          <h2 className="mt-2 font-display text-3xl text-foreground">Your recommendation</h2>
          <p className="mt-3 text-muted-foreground">{data.summary || <em>No summary set.</em>}</p>

          {data.red_flags?.length > 0 && (
            <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-destructive">Red flags</p>
              <ul className="mt-1 list-disc pl-5 text-foreground">
                {data.red_flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="divider-gold mt-6" />

          {attachedProducts.length > 0 && (
            <section className="mt-8">
              <h3 className="font-display text-xl text-foreground">Your prescribed support</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {attachedProducts.map((p) => (
                  <ProductCard key={p.product_id} product={p} />
                ))}
              </div>
            </section>
          )}

          <div className="mt-8 space-y-5">
            {data.recommendations.length === 0 && (
              <p className="text-sm italic text-muted-foreground">No recommendations added yet.</p>
            )}
            {data.recommendations.map((r, i) => (
              <article key={i} className="rounded-2xl border border-border bg-surface p-5">
                <ModalityBadge modality={r.modality} />
                <h4 className="mt-2 font-display text-xl text-foreground">{r.title || "Untitled"}</h4>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">{r.rationale}</p>

                {r.suggested_products?.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs uppercase tracking-wider text-gold">Suggested</h5>
                    <ul className="mt-2 space-y-2">
                      {r.suggested_products.map((p, j) => (
                        <li key={j} className="rounded-lg border border-border bg-background p-2 text-sm">
                          <p className="font-medium text-foreground">{p.name}</p>
                          {(p.form || p.dosage) && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {[p.form, p.dosage].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {p.notes && <p className="mt-0.5 text-sm text-muted-foreground">{p.notes}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.safety_notes && (
                  <div className="mt-4 rounded-lg border border-violet/40 bg-violet/5 p-2 text-sm">
                    <p className="text-xs uppercase tracking-wider text-violet">Safety</p>
                    <p className="mt-0.5">{r.safety_notes}</p>
                  </div>
                )}

                {r.citations?.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-xs uppercase tracking-wider text-muted-foreground">References</h5>
                    <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                      {r.citations.map((c, k) => (
                        <li key={k}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>

          {data.safety_filtered && data.safety_filtered.applied_flags.length > 0 && (
            <div className="mt-6 rounded-xl border border-violet/40 bg-violet/5 p-4">
              <div className="flex items-center gap-2 text-violet">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.2em]">Auto safety filter</span>
              </div>
              <p className="mt-1 text-sm text-foreground">
                Catalog filtered for: {data.safety_filtered.applied_flags.join(", ")}.
              </p>
              {data.safety_filtered.excluded_products.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {data.safety_filtered.excluded_products.slice(0, 8).map((p, i) => (
                    <li key={i}>
                      <span className="text-foreground/80">{p.name}</span>
                      {p.reason && <> — {p.reason}</>}
                    </li>
                  ))}
                  {data.safety_filtered.excluded_products.length > 8 && (
                    <li>+ {data.safety_filtered.excluded_products.length - 8} more</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {reviewerNotes && (
            <div className="mt-6 rounded-xl border border-border bg-surface p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Reviewer notes</p>
              <p className="mt-1 text-sm text-foreground">{reviewerNotes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-3 border-t border-border bg-surface/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Patient must sign in or sign up with the email used at intake to view this prescription.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Back to edit
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy ? "Approving…" : "Approve & publish"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
