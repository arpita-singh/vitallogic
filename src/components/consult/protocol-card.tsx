import { BookOpen, ExternalLink, Sparkles, ShieldAlert } from "lucide-react";
import type { AttachedProtocol } from "@/components/expert/wisdom-picker";

const MODALITY_LABEL: Record<AttachedProtocol["modality"], string> = {
  yoga: "Yoga",
  pranayama: "Pranayama",
  element_therapy: "Five-Element Therapy",
  mud_therapy: "Mud Therapy",
  magnet_therapy: "Magnet Therapy",
  acupressure: "Acupressure",
  shatkarma: "Shatkarma",
  daily_schedule: "Daily Schedule",
};

const EVIDENCE_CLS: Record<AttachedProtocol["evidence_level"], string> = {
  clinical: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  traditional: "border-gold/40 bg-gold/10 text-gold",
  empirical: "border-violet/40 bg-violet/10 text-violet",
};

export function ProtocolCard({ protocol }: { protocol: AttachedProtocol }) {
  const modalityLabel = MODALITY_LABEL[protocol.modality];
  const evidenceCls = EVIDENCE_CLS[protocol.evidence_level];
  const sourceLabel = protocol.source_name.split("—")[0].trim();

  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-violet/40">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full border border-violet/40 bg-violet/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-violet">
          {modalityLabel}
        </span>
        {protocol.element && (
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {protocol.element}
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${evidenceCls}`}
        >
          {protocol.evidence_level}
        </span>
      </div>

      <h4 className="mt-3 font-display text-xl leading-tight text-foreground">
        {protocol.name}
      </h4>
      {protocol.name_native && (
        <p className="mt-0.5 text-sm text-muted-foreground">{protocol.name_native}</p>
      )}

      {protocol.protocol_steps.length > 0 && (
        <ol className="mt-4 space-y-2 text-sm text-foreground/90">
          {protocol.protocol_steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-mono text-[11px] text-violet">
                {step.time ?? `${(step.step ?? i + 1).toString().padStart(2, "0")}`}
              </span>
              <span>
                {step.name && <span className="font-medium text-foreground">{step.name}</span>}
                {step.name && (step.detail || step.activity) && " — "}
                {step.detail ?? step.activity ?? ""}
                {step.duration_min ? (
                  <span className="text-muted-foreground"> · {step.duration_min} min</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}

      {protocol.expected_outcome && (
        <p className="mt-4 text-xs italic text-muted-foreground">
          {protocol.expected_outcome}
        </p>
      )}

      {protocol.practitioner_note && (
        <div className="mt-4 rounded-xl border border-violet/30 bg-violet/5 p-3 text-sm text-foreground/90">
          <p className="text-[10px] uppercase tracking-wider text-violet">Practitioner note</p>
          <p className="mt-1">{protocol.practitioner_note}</p>
        </div>
      )}

      {protocol.contraindications.length > 0 && (
        <div className="mt-3 rounded-xl border border-orange-400/30 bg-orange-400/5 p-3 text-xs text-foreground/90">
          <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-orange-300">
            <ShieldAlert className="h-3 w-3" /> Avoid if
          </p>
          <p className="mt-1">{protocol.contraindications.join(" · ")}</p>
        </div>
      )}

      <div className="mt-auto border-t border-border/60 pt-4">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3 w-3 text-gold" />
            <span>
              Tradition: <span className="text-foreground">{protocol.source_tradition ?? sourceLabel}</span>
            </span>
          </span>
          {protocol.source_url && (
            <a
              href={protocol.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-violet hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> source
            </a>
          )}
        </div>
        {protocol.snapshot_at && (
          <p
            className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground/70"
            title="Immutable snapshot of the wisdom library at the time this prescription was issued."
          >
            <Sparkles className="mr-0.5 inline h-2.5 w-2.5 text-gold" />
            Catalog snapshot · {new Date(protocol.snapshot_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </article>
  );
}
