-- Force a PostgREST schema cache reload by issuing a DDL change + explicit notify.
COMMENT ON TABLE public.user_section_permissions IS 'Per-user access grants to big sections and sub-sections. v2';
COMMENT ON COLUMN public.user_section_permissions.section_key IS 'Big section identifier (e.g. magasin, commerciale).';
COMMENT ON COLUMN public.user_section_permissions.subsection_key IS 'Sub-section identifier or empty for full section access.';

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';