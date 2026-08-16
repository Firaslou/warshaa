-- Each listing can use its own call number. Existing listings inherit the
-- current shop number; new forms prefill it but allow creators to override it.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS contact_phone text;

UPDATE public.products p
SET contact_phone = s.whatsapp_number
FROM public.startups s
WHERE s.id = p.startup_id
  AND p.contact_phone IS NULL
  AND s.whatsapp_number ~ '^[+0-9(). -]+$'
  AND char_length(regexp_replace(s.whatsapp_number, '[^0-9]', '', 'g')) BETWEEN 6 AND 15;

UPDATE public.services sv
SET contact_phone = s.whatsapp_number
FROM public.startups s
WHERE s.id = sv.startup_id
  AND sv.contact_phone IS NULL
  AND s.whatsapp_number ~ '^[+0-9(). -]+$'
  AND char_length(regexp_replace(s.whatsapp_number, '[^0-9]', '', 'g')) BETWEEN 6 AND 15;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_contact_phone_length_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_contact_phone_length_check
  CHECK (
    contact_phone IS NULL OR (
      contact_phone ~ '^[+0-9(). -]+$'
      AND char_length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) BETWEEN 6 AND 15
    )
  );

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_contact_phone_length_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_contact_phone_length_check
  CHECK (
    contact_phone IS NULL OR (
      contact_phone ~ '^[+0-9(). -]+$'
      AND char_length(regexp_replace(contact_phone, '[^0-9]', '', 'g')) BETWEEN 6 AND 15
    )
  );
