import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus, X, BookOpen, Sparkles } from "lucide-react";
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

export type Modality =
  | "yoga"
  | "pranayama"
  | "element_therapy"
  | "mud_therapy"
  | "magnet_therapy"
  | "acupressure"
  | "shatkarma"
  | "daily_schedule";

export type Element = "space" | "air" | "fire" | "water" | "earth";
export type EvidenceLevel = "empirical" | "traditional" | "clinical";

export type ProtocolStep = {
  step?: number;
  name?: string;
  detail?: string;
  duration_min?: number;
  time?: string;
  activity?: string;
};

export type CatalogProtocol = {
  id: string;
  source_id: string;
  name: string;
  name_native: string | null;
  modality: Modality;
  element: Element | null;
  indications: string[];
  contraindications: string[];
  protocol_steps: ProtocolStep[];
  expected_outcome: string | null;
  evidence_level: EvidenceLevel;
  source_name: string;
  source_tradition: string | null;
  source_url: string | null;
};

export type AttachedProtocol = {
  protocol_id: string;
  source_id: string;
  name: string;
  name_native: string | null;
  modality: Modality;
  element: Element | null;
  indications: string[];
  contraindications: string[];
  protocol_steps: ProtocolStep[];
  expected_outcome: string | null;
  evidence_level: EvidenceLevel;
  source_name: string;
  source_tradition: string | null;
  source_url: string | null;
  practitioner_note: string;
  snapshot_at: string;
};

const MODALITY_LABEL: Record<Modality, string> = {
  yoga: "Yoga",
  pranayama: "Pranayama",
  element_therapy: "Five-Element",
  mud_therapy: "Mud Therapy",
  magnet_therapy: "Magnet Therapy",
  acupressure: "Acupressure",
  shatkarma: "Shatkarma",
  daily_schedule: "Daily Schedule",
};

const EVIDENCE_CLS: Record<EvidenceLevel, string> = {
  clinical: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  traditional: "border-gold/40 bg-gold/10 text-gold",
  empirical: "border-violet/40 bg-violet/10 text-violet",
};

export function WisdomPicker({
  value,
  onChange,
  disabled,
}: {
  value: AttachedProtocol[];
  onChange: (next: AttachedProtocol[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [protocols, setProtocols] = useState<CatalogProtocol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("wisdom_protocols")
        .select(
          `id, source_id, name, name_native, modality, element, indications, contraindications,
           protocol_steps, expected_outcome, evidence_level,
           wisdom_sources!inner ( name, tradition, authority_url )`,
        )
        .order("modality", { ascending: true })
        .order("name", { ascending: true });
      if (cancelled) return;
      if (error) console.error(error);
      const rows = (data ?? []).map((r) => {
        const src = (r as { wisdom_sources?: { name: string; tradition: string | null; authority_url: string | null } })
          .wisdom_sources;
        return {
          id: r.id,
          source_id: r.source_id,
          name: r.name,
          name_native: r.name_native,
          modality: r.modality as Modality,
          element: r.element as Element | null,
          indications: (r.indications ?? []) as string[],
          contraindications: (r.contraindications ?? []) as string[],
          protocol_steps: (r.protocol_steps ?? []) as ProtocolStep[],
          expected_outcome: r.expected_outcome,
          evidence_level: r.evidence_level as EvidenceLevel,
          source_name: src?.name ?? "Unknown source",
          source_tradition: src?.tradition ?? null,
          source_url: src?.authority_url ?? null,
        } satisfies CatalogProtocol;
      });
      setProtocols(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIds = new Set(value.map((p) => p.protocol_id));
  const grouped = protocols.reduce<Record<string, CatalogProtocol[]>>((acc, p) => {
    (acc[MODALITY_LABEL[p.modality]] ||= []).push(p);
    return acc;
  }, {});

  const toggle = (p: CatalogProtocol) => {
    if (selectedIds.has(p.id)) {
      onChange(value.filter((v) => v.protocol_id !== p.id));
    } else {
      onChange([
        ...value,
        {
          protocol_id: p.id,
          source_id: p.source_id,
          name: p.name,
          name_native: p.name_native,
          modality: p.modality,
          element: p.element,
          indications: p.indications,
          contraindications: p.contraindications,
          protocol_steps: p.protocol_steps,
          expected_outcome: p.expected_outcome,
          evidence_level: p.evidence_level,
          source_name: p.source_name,
          source_tradition: p.source_tradition,
          source_url: p.source_url,
          practitioner_note: "",
          snapshot_at: new Date().toISOString(),
        },
      ]);
    }
  };

  const updateNote = (id: string, note: string) => {
    onChange(value.map((v) => (v.protocol_id === id ? { ...v, practitioner_note: note } : v)));
  };

  const remove = (id: string) => onChange(value.filter((v) => v.protocol_id !== id));

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
              <Plus className="h-4 w-4 text-violet" />
              {loading ? "Loading wisdom library…" : "Search practices & protocols"}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(value, search) => {
              // Custom filter — search across all the metadata we joined into the value string
              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Search by name, indication, element…" />
            <CommandList className="max-h-80">
              <CommandEmpty>No protocols found.</CommandEmpty>
              {Object.entries(grouped).map(([modalityLabel, items]) => (
                <CommandGroup key={modalityLabel} heading={modalityLabel}>
                  {items.map((p) => {
                    const selected = selectedIds.has(p.id);
                    const searchValue = `${p.name} ${p.name_native ?? ""} ${p.indications.join(" ")} ${p.element ?? ""} ${p.source_name}`;
                    return (
                      <CommandItem
                        key={p.id}
                        value={searchValue}
                        onSelect={() => toggle(p)}
                        className="flex items-start gap-2"
                      >
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0 text-violet",
                            selected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {p.name}
                            </span>
                            {p.element && (
                              <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                                {p.element}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <span
                              className={`rounded border px-1 py-px uppercase tracking-wider ${EVIDENCE_CLS[p.evidence_level]}`}
                            >
                              {p.evidence_level}
                            </span>
                            <span className="inline-flex items-center gap-0.5">
                              <BookOpen className="h-2.5 w-2.5" /> {p.source_name.split("—")[0].trim()}
                            </span>
                            {p.indications.slice(0, 2).map((ind) => (
                              <span
                                key={ind}
                                className="rounded border border-border px-1 py-px text-muted-foreground/80"
                              >
                                {ind}
                              </span>
                            ))}
                            {p.indications.length > 2 && (
                              <span className="text-muted-foreground/60">
                                +{p.indications.length - 2}
                              </span>
                            )}
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
        <p className="text-xs text-muted-foreground">No practices attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((p) => (
            <li key={p.protocol_id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    {p.element && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {p.element}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-violet/40 bg-violet/10 px-2 py-px uppercase tracking-wider text-violet">
                      {MODALITY_LABEL[p.modality]}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-px uppercase tracking-wider ${EVIDENCE_CLS[p.evidence_level]}`}
                    >
                      {p.evidence_level}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Sparkles className="h-2.5 w-2.5 text-gold" /> {p.source_name.split("—")[0].trim()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(p.protocol_id)}
                  disabled={disabled}
                  aria-label="Remove protocol"
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                value={p.practitioner_note}
                onChange={(e) => updateNote(p.protocol_id, e.target.value)}
                disabled={disabled}
                placeholder="Practitioner note for this patient (optional)"
                className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-violet focus:outline-none disabled:opacity-60"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
