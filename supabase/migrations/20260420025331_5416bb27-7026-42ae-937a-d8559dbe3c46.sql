ALTER TABLE public.certified_materia_medica
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS source_authority text,
  ADD COLUMN IF NOT EXISTS artg_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.certified_materia_medica
  DROP CONSTRAINT IF EXISTS certified_materia_medica_source_authority_check;

ALTER TABLE public.certified_materia_medica
  ADD CONSTRAINT certified_materia_medica_source_authority_check
  CHECK (source_authority IS NULL OR source_authority IN ('clinical', 'traditional', 'consecrated'));