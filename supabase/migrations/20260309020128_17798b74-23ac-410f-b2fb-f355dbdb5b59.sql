-- Fix: overly permissive leave_requests INSERT (any authenticated user could insert PII)
-- Add submitted_by tracking + enforce role-based insert + ensure submitted_by is set

BEGIN;

-- Add submitter column (keep nullable for existing rows)
ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS submitted_by uuid;

-- Ensure submitted_by is set for new rows
CREATE OR REPLACE FUNCTION public.set_leave_request_submitted_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.submitted_by IS NULL THEN
    NEW.submitted_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_requests_set_submitted_by ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_set_submitted_by
BEFORE INSERT ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_leave_request_submitted_by();

-- Replace INSERT policy to require proper role + tie row to submitter
DROP POLICY IF EXISTS "Authenticated users can submit leave requests" ON public.leave_requests;

CREATE POLICY "Owners/admins/teachers can submit leave requests"
ON public.leave_requests AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (
  (
    has_role(auth.uid(), 'owner'::public.app_role)
    OR has_role(auth.uid(), 'admin'::public.app_role)
    OR has_role(auth.uid(), 'teacher'::public.app_role)
  )
  AND submitted_by = auth.uid()
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);

COMMIT;