// Client-safe shared types for consult flows. No server imports, no zod —
// safe to import from anywhere (route components, edge function callers, etc.).
export type Intake = {
  symptoms: string[];
  symptomsNote?: string;
  duration?: "acute" | "subacute" | "chronic";
  severity?: number;
  sleepHours?: number;
  stress?: number;
  diet?: string;
  activity?: number;
  meds?: string;
  allergies?: string;
  pregnancy?: "yes" | "no" | "na";
  under18?: boolean;
  goals: string[];
  contactEmail?: string;
  contactName?: string;
};
