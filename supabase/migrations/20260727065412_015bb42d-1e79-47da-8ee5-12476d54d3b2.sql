CREATE TABLE public.service_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type text NOT NULL CHECK (item_type IN ('package','addon','vehicle')),
  item_id text NOT NULL,
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_type, item_id)
);

GRANT SELECT ON public.service_prices TO anon;
GRANT SELECT ON public.service_prices TO authenticated;
GRANT ALL ON public.service_prices TO service_role;

ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read service prices"
  ON public.service_prices FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can insert service prices"
  ON public.service_prices FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update service prices"
  ON public.service_prices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER service_prices_set_updated_at
  BEFORE UPDATE ON public.service_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.service_prices (item_type, item_id, label, amount) VALUES
  ('package','basis','Basis Pflege',149),
  ('package','premium','Premium Glanz',349),
  ('package','keramik','High-End Keramik',899),
  ('addon','felgen','Felgen-Spezial',89),
  ('addon','ozon','Innenraum-Ozon',59),
  ('addon','motor','Motorwäsche',69),
  ('addon','leder','Lederpflege Deluxe',119),
  ('addon','scheinwerfer','Scheinwerfer-Aufbereitung',79),
  ('addon','hol','Hol- & Bringservice (Abholservice)',60),
  ('vehicle','kompakt','Kompaktklasse (Faktor)',1),
  ('vehicle','suv','SUV / Limousine (Faktor)',1.25),
  ('vehicle','transporter','Transporter (Faktor)',1.55);