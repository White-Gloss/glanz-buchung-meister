-- Ausgangslage für den RLS-Test: zwei Konten, schützenswerte Daten,
-- veröffentlichte und unveröffentlichte Inhalte.
--
-- NUR FÜR DEN TEST — liegt bewusst nicht unter supabase/migrations/.

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin@example.de'),
  ('22222222-2222-4222-8222-222222222222', 'fremd@example.de');

-- Nur der erste ist Administrator. Der zweite ist ein ganz normaler,
-- angemeldeter Benutzer — genau die Rolle, die am meisten Schaden
-- anrichten könnte, wenn eine Regel zu weit gefasst wäre.
INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin');

INSERT INTO public.bookings
  (invoice_number, vehicle_id, package_id, booking_date, booking_time,
   customer_name, customer_email, customer_phone, customer_plate, total)
VALUES ('WGD-TEST-1', 'limousine', 'basis', current_date + 3, '10:00',
        'Testkunde', 'kunde@example.de', '+49 170 1234567', 'B-XY-123', 199);

INSERT INTO public.customer_notes (customer_email, note)
  VALUES ('kunde@example.de', 'Interne Notiz');

INSERT INTO public.calendar_feed_tokens (user_id)
  VALUES ('11111111-1111-4111-8111-111111111111');

INSERT INTO public.system_events (area, event, severity)
  VALUES ('mail', 'Testeintrag', 'fehler');

INSERT INTO public.automation_heartbeat (area, detail)
  VALUES ('automation-cron', 'kandidaten=0');

-- Ein Entwurf, ein für die Zukunft geplanter Beitrag, ein veröffentlichter.
INSERT INTO public.blog_posts (slug, title, content, published_at) VALUES
  ('entwurf',     'ENTWURF',       'intern', NULL),
  ('geplant',     'GEPLANT',       'intern', now() + interval '7 days'),
  ('oeffentlich', 'VEROEFFENTLICHT','Text',  now() - interval '1 day');

INSERT INTO public.gallery_items (storage_path, title, is_published) VALUES
  ('geheim.jpg',   'UNVEROEFFENTLICHT', false),
  ('sichtbar.jpg', 'VEROEFFENTLICHT',   true);

INSERT INTO public.faqs (question, answer, is_published) VALUES
  ('GEHEIM?',       'intern', false),
  ('OEFFENTLICH?',  'Text',   true);
