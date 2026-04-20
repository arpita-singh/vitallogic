-- Slice B: Safety guardrails for the materia medica catalog.
-- Schema example:
--   {
--     "contraindications": ["Hyperthyroidism"],
--     "drug_interactions": ["Sedatives", "Thyroid hormones"],
--     "pregnancy_unsafe": true,
--     "breastfeeding_unsafe": false,
--     "hyperthyroid_unsafe": true,
--     "autoimmune_unsafe": true,
--     "under18_unsafe": false,
--     "notes": "Avoid in severe digestive congestion (Ama)."
--   }
ALTER TABLE public.certified_materia_medica
  ADD COLUMN IF NOT EXISTS safety_guardrails jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Lightweight index for the most common filter (pregnancy).
CREATE INDEX IF NOT EXISTS certified_materia_medica_pregnancy_unsafe_idx
  ON public.certified_materia_medica ((safety_guardrails->>'pregnancy_unsafe'));

COMMENT ON COLUMN public.certified_materia_medica.safety_guardrails IS
  'Structured safety flags consumed by generate-prescription. Keys: contraindications[], drug_interactions[], pregnancy_unsafe, breastfeeding_unsafe, hyperthyroid_unsafe, autoimmune_unsafe, under18_unsafe, notes.';