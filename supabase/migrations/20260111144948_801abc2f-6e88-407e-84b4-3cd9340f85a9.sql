-- Fix documents table RLS policies to restrict access based on ownership

-- Drop all existing policies on documents table
DROP POLICY IF EXISTS "Allow authenticated read on documents" ON public.documents;
DROP POLICY IF EXISTS "Allow authenticated insert on documents" ON public.documents;
DROP POLICY IF EXISTS "Allow authenticated update on documents" ON public.documents;
DROP POLICY IF EXISTS "Allow authenticated delete on documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Users can read own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;

-- Create owner-based read policy (users see their own documents, admins see all)
CREATE POLICY "Users can read own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- Create insert policy that enforces ownership
CREATE POLICY "Users can create documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Create update policy for own documents or admin
CREATE POLICY "Users can update own documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- Create delete policy (admin only for deletion)
CREATE POLICY "Admins can delete documents"
ON public.documents
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));