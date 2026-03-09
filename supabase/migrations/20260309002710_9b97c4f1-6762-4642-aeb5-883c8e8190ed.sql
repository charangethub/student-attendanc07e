-- Fix the permissive RLS policy for leave requests
DROP POLICY IF EXISTS "Anyone can submit leave requests" ON public.leave_requests;
CREATE POLICY "Authenticated users can submit leave requests" ON public.leave_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);