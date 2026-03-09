-- Fix: Restrict students table to approved users with roles
DROP POLICY IF EXISTS "Authenticated users can view students" ON public.students;
DROP POLICY IF EXISTS "Approved users can view students" ON public.students;
CREATE POLICY "Approved users can view students"
ON public.students
AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'teacher'::app_role)
);

-- Fix: Ensure leave requests can only be inserted with status 'pending'
DROP POLICY IF EXISTS "Authenticated users can submit leave requests" ON public.leave_requests;
CREATE POLICY "Authenticated users can submit leave requests"
ON public.leave_requests
AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  status = 'pending' AND 
  reviewed_by IS NULL AND 
  reviewed_at IS NULL
);

-- Fix: Restrict teachers from updating past attendance
DROP POLICY IF EXISTS "Teachers/admins/owners can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers restricted to today for updates" ON public.attendance;
CREATE POLICY "Teachers restricted to today for updates"
ON public.attendance
AS PERMISSIVE
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'teacher'::app_role) AND date = CURRENT_DATE)
);