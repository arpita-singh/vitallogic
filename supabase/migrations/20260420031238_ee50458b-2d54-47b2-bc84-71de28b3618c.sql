-- Wisdom sources: provenance for cited traditions/authorities
CREATE TABLE public.wisdom_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tradition TEXT,
  authority_url TEXT,
  bibliography JSONB NOT NULL DEFAULT '[]'::jsonb,
  practitioner_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wisdom_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wisdom sources: public read"
  ON public.wisdom_sources FOR SELECT USING (true);

CREATE POLICY "Wisdom sources: experts/admins insert"
  ON public.wisdom_sources FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'expert'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Wisdom sources: experts/admins update"
  ON public.wisdom_sources FOR UPDATE
  USING (has_role(auth.uid(), 'expert'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Wisdom sources: admins delete"
  ON public.wisdom_sources FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_wisdom_sources_updated_at
  BEFORE UPDATE ON public.wisdom_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Wisdom protocols: atomic, attachable practices
CREATE TABLE public.wisdom_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.wisdom_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_native TEXT,
  modality TEXT NOT NULL,
  element TEXT,
  indications TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  contraindications TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  protocol_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_outcome TEXT,
  evidence_level TEXT NOT NULL DEFAULT 'traditional',
  artg_relevant BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wisdom_protocols_modality_check CHECK (modality IN (
    'yoga','pranayama','element_therapy','mud_therapy','magnet_therapy','acupressure','shatkarma','daily_schedule'
  )),
  CONSTRAINT wisdom_protocols_element_check CHECK (element IS NULL OR element IN (
    'space','air','fire','water','earth'
  )),
  CONSTRAINT wisdom_protocols_evidence_check CHECK (evidence_level IN (
    'empirical','traditional','clinical'
  ))
);

CREATE INDEX idx_wisdom_protocols_source ON public.wisdom_protocols(source_id);
CREATE INDEX idx_wisdom_protocols_modality ON public.wisdom_protocols(modality);
CREATE INDEX idx_wisdom_protocols_indications ON public.wisdom_protocols USING GIN(indications);

ALTER TABLE public.wisdom_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wisdom protocols: public read"
  ON public.wisdom_protocols FOR SELECT USING (true);

CREATE POLICY "Wisdom protocols: experts/admins insert"
  ON public.wisdom_protocols FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'expert'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Wisdom protocols: experts/admins update"
  ON public.wisdom_protocols FOR UPDATE
  USING (has_role(auth.uid(), 'expert'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Wisdom protocols: admins delete"
  ON public.wisdom_protocols FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_wisdom_protocols_updated_at
  BEFORE UPDATE ON public.wisdom_protocols
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add attached_protocols snapshot column to prescriptions (mirrors attached_products)
ALTER TABLE public.prescriptions
  ADD COLUMN attached_protocols JSONB NOT NULL DEFAULT '[]'::jsonb;