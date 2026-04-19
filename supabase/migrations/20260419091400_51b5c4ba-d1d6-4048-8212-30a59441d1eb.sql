-- ============================================
-- 1. certified_materia_medica (marketplace inventory)
-- ============================================
CREATE TABLE public.certified_materia_medica (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  aust_l_number TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_status BOOLEAN NOT NULL DEFAULT true,
  vendor_name TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.certified_materia_medica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog: public read"
  ON public.certified_materia_medica
  FOR SELECT
  USING (true);

CREATE POLICY "Catalog: experts/admins insert"
  ON public.certified_materia_medica
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'expert'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Catalog: experts/admins update"
  ON public.certified_materia_medica
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'expert'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Catalog: admins delete"
  ON public.certified_materia_medica
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_certified_materia_medica_updated_at
  BEFORE UPDATE ON public.certified_materia_medica
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cmm_category ON public.certified_materia_medica(category);
CREATE INDEX idx_cmm_stock ON public.certified_materia_medica(stock_status) WHERE stock_status = true;

-- ============================================
-- 2. user_purchases (payment ledger placeholder)
-- ============================================
CREATE TABLE public.user_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consult_id UUID,
  has_unlocked_education BOOLEAN NOT NULL DEFAULT false,
  purchased_medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Purchases: owner can select"
  ON public.user_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Purchases: owner can insert"
  ON public.user_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Purchases: owner can update"
  ON public.user_purchases
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Purchases: experts/admins can select all"
  ON public.user_purchases
  FOR SELECT
  USING (public.has_role(auth.uid(), 'expert'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_purchases_updated_at
  BEFORE UPDATE ON public.user_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_purchases_user ON public.user_purchases(user_id);

-- ============================================
-- 3. Add attached_products to prescriptions
-- ============================================
ALTER TABLE public.prescriptions
  ADD COLUMN attached_products JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================
-- 4. Seed marketplace
-- ============================================
INSERT INTO public.certified_materia_medica (product_name, category, aust_l_number, price, vendor_name, description) VALUES
  ('Ashwagandha Root Extract', 'Ayurveda', 'AUST L 123456', 34.95, 'Vital Roots Co.', 'Adaptogenic root traditionally used to support resilience to stress and balanced energy.'),
  ('Triphala Digestive Blend', 'Ayurveda', 'AUST L 234567', 28.50, 'Sacred Earth Herbals', 'Classical three-fruit formula to gently support digestion and elimination.'),
  ('Magnesium Glycinate Complex', 'Naturopathy', 'AUST L 345678', 42.00, 'Nutrigenix Australia', 'Highly bioavailable magnesium for muscle relaxation and restful sleep.'),
  ('Liposomal Vitamin C 1000mg', 'Naturopathy', 'AUST L 456789', 49.95, 'Nutrigenix Australia', 'Phospholipid-encapsulated vitamin C for enhanced absorption and immune support.'),
  ('Lemon Myrtle Immune Tonic', 'Indigenous', 'AUST L 567890', 38.00, 'Bushland Apothecary', 'Native lemon myrtle and Kakadu plum tonic — antioxidant-rich daily support.'),
  ('Old Man Weed Skin Salve', 'Indigenous', 'AUST L 678901', 24.95, 'Bushland Apothecary', 'Traditional Centipeda cunninghamii salve for soothing irritated or compromised skin.');