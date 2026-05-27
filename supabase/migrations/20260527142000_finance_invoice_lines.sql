-- Finance Sales/Purchases invoice lines (real ERP line items)

CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  product_code text,
  description text NOT NULL,
  quantity numeric(14, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_ht numeric(14, 3) NOT NULL DEFAULT 0 CHECK (unit_price_ht >= 0),
  vat_rate numeric(5, 2) NOT NULL DEFAULT 19 CHECK (vat_rate IN (0, 7, 13, 19)),
  total_ht numeric(14, 3) NOT NULL DEFAULT 0 CHECK (total_ht >= 0),
  total_tva numeric(14, 3) NOT NULL DEFAULT 0 CHECK (total_tva >= 0),
  total_ttc numeric(14, 3) NOT NULL DEFAULT 0 CHECK (total_ttc >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx ON public.invoice_lines (invoice_id);

DROP TRIGGER IF EXISTS handle_invoice_lines_updated_at ON public.invoice_lines;
CREATE TRIGGER handle_invoice_lines_updated_at
  BEFORE UPDATE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.finance_set_updated_at ();

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_lines_select_finance ON public.invoice_lines;
CREATE POLICY invoice_lines_select_finance ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.company_id IN (
          SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()
        )
    )
  );

DROP POLICY IF EXISTS invoice_lines_insert_finance ON public.invoice_lines;
CREATE POLICY invoice_lines_insert_finance ON public.invoice_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.company_id IN (
          SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()
        )
    )
  );

DROP POLICY IF EXISTS invoice_lines_update_finance ON public.invoice_lines;
CREATE POLICY invoice_lines_update_finance ON public.invoice_lines
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.company_id IN (
          SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.company_id IN (
          SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()
        )
    )
  );

DROP POLICY IF EXISTS invoice_lines_delete_finance ON public.invoice_lines;
CREATE POLICY invoice_lines_delete_finance ON public.invoice_lines
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND i.company_id IN (
          SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid ()
        )
    )
  );

