-- Galerie commerciale & Rendez-vous moved from section "ventes" to "commercial".

UPDATE public.user_section_permissions
SET section_key = 'commercial'
WHERE section_key = 'ventes'
  AND subsection_key IN ('gallery', 'rdv');

-- Full Ventes access previously included gallery/rdv via the whole section.
INSERT INTO public.user_section_permissions (user_id, section_key, subsection_key)
SELECT DISTINCT user_id, 'commercial', ''
FROM public.user_section_permissions
WHERE section_key = 'ventes'
  AND (subsection_key = '' OR subsection_key IS NULL)
ON CONFLICT (user_id, section_key, subsection_key) DO NOTHING;
