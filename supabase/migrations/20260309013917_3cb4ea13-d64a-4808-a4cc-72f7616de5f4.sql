-- Fix: Teachers Can Self-Approve Leave Requests
DROP POLICY IF EXISTS "Teachers/admins can update leave requests" ON public.leave_requests;

CREATE POLICY "Admins/owners can update leave requests"
ON public.leave_requests AS PERMISSIVE
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Fix: Admin Can Delete Owner's Role (Privilege Stripping)
DROP POLICY IF EXISTS "Owners/admins can delete roles" ON public.user_roles;

CREATE POLICY "Owners/admins can delete roles"
ON public.user_roles AS PERMISSIVE
FOR DELETE TO authenticated
USING (
  -- Owners can delete any role
  has_role(auth.uid(), 'owner'::app_role)
  OR (
    -- Admins can only delete non-owner roles
    has_role(auth.uid(), 'admin'::app_role)
    AND NOT has_role(user_id, 'owner'::app_role)
  )
);