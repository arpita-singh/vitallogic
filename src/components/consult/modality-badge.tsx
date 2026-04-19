import { cn } from "@/lib/utils";

export type Modality =
  | "ayurveda"
  | "western_naturopathy"
  | "indigenous"
  | "plant_medicine"
  | "lifestyle";

const labels: Record<Modality, string> = {
  ayurveda: "Ayurveda",
  western_naturopathy: "Western Naturopathy",
  indigenous: "Indigenous",
  plant_medicine: "Plant Medicine",
  lifestyle: "Lifestyle",
};

const styles: Record<Modality, string> = {
  ayurveda: "border-gold/40 bg-gold/10 text-gold",
  western_naturopathy: "border-violet/40 bg-violet/10 text-violet",
  indigenous: "border-cream/30 bg-cream/5 text-cream",
  plant_medicine: "border-gold/40 bg-gold/10 text-gold",
  lifestyle: "border-violet/40 bg-violet/10 text-violet",
};

export function ModalityBadge({ modality, className }: { modality: Modality; className?: string }) {
  const label = labels[modality] ?? modality;
  const style = styles[modality] ?? styles.lifestyle;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-wider",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
