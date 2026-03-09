-- Allow owners and admins to delete roles
DROP POLICY IF EXISTS "Owners can delete roles" ON public.user_roles;
CREATE POLICY "Owners and admins can delete roles" ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow owners and admins to delete profiles
CREATE POLICY "Owners and admins can delete profiles" ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
