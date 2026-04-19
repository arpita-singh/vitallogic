ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS claimed_by uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS prescriptions_status_idx ON public.prescriptions(status);
CREATE INDEX IF NOT EXISTS prescriptions_claimed_by_idx ON public.prescriptions(claimed_by);