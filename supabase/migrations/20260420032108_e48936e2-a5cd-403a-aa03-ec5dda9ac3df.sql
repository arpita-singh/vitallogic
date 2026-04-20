ALTER TABLE public.certified_materia_medica
  ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS import_external_id text;

ALTER TABLE public.certified_materia_medica
  ADD CONSTRAINT certified_materia_medica_import_status_check
  CHECK (import_status IN ('live', 'pending_review', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS certified_materia_medica_import_dedupe_idx
  ON public.certified_materia_medica (import_source, import_external_id)
  WHERE import_source IS NOT NULL AND import_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS certified_materia_medica_import_status_idx
  ON public.certified_materia_medica (import_status);