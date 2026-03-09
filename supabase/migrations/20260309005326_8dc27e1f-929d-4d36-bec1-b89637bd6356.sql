
-- Fix page_access policies: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Owners/admins can manage page access" ON public.page_access;
DROP POLICY IF EXISTS "Owners/admins can view page access" ON public.page_access;

CREATE POLICY "Owners/admins can manage page access"
ON public.page_access
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own page access"
ON public.page_access
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix user_status policies: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Owners/admins can manage status" ON public.user_status;
DROP POLICY IF EXISTS "Owners/admins can view status" ON public.user_status;

CREATE POLICY "Owners/admins can manage status"
ON public.user_status
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own status"
ON public.user_status
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix user_roles policies: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Owners and admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners/admins can view all roles" ON public.user_roles;

CREATE POLICY "Owners can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners/admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));
