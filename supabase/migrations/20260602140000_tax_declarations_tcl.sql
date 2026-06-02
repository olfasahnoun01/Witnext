-- TCL à Payer — saisie manuelle par période fiscale (tax_declarations)
ALTER TABLE public.tax_declarations
  ADD COLUMN IF NOT EXISTS tcl_due numeric(14, 3);

COMMENT ON COLUMN public.tax_declarations.tcl_due IS
  'Taxe sur les conventions de prêt (TCL) à payer pour la période — saisie manuelle.';
