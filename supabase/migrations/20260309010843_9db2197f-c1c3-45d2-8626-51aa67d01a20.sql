
-- Drop ALL existing policies on the three auth-critical tables and recreate as explicitly PERMISSIVE

-- ========== page_access ==========
DROP POLICY IF EXISTS "Owners/admins can manage page access" ON public.page_access;
DROP POLICY IF EXISTS "Users can view own page access" ON public.page_access;

CREATE POLICY "Users can view own page access"
ON public.page_access AS PERMISSIVE
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can manage page access"
ON public.page_access AS PERMISSIVE
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- ========== user_status ==========
DROP POLICY IF EXISTS "Owners/admins can manage status" ON public.user_status;
DROP POLICY IF EXISTS "Users can view own status" ON public.user_status;

CREATE POLICY "Users can view own status"
ON public.user_status AS PERMISSIVE
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can manage status"
ON public.user_status AS PERMISSIVE
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- ========== user_roles ==========
DROP POLICY IF EXISTS "Owners can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners/admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Owners/admins can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
ON public.user_roles AS PERMISSIVE
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can view all roles"
ON public.user_roles AS PERMISSIVE
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can insert roles"
ON public.user_roles AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update roles"
ON public.user_roles AS PERMISSIVE
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners/admins can delete roles"
ON public.user_roles AS PERMISSIVE
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- ========== attendance (also fix for page functionality) ==========
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers/admins/owners can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers/admins/owners can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Owners/admins can delete attendance" ON public.attendance;

CREATE POLICY "Authenticated users can view attendance"
ON public.attendance AS PERMISSIVE
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers/admins/owners can insert attendance"
ON public.attendance AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers/admins/owners can update attendance"
ON public.attendance AS PERMISSIVE
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Owners/admins can delete attendance"
ON public.attendance AS PERMISSIVE
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- ========== students ==========
DROP POLICY IF EXISTS "Authenticated users can view students" ON public.students;
DROP POLICY IF EXISTS "Owners/admins can manage students" ON public.students;

CREATE POLICY "Authenticated users can view students"
ON public.students AS PERMISSIVE
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Owners/admins can manage students"
ON public.students AS PERMISSIVE
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- ========== profiles ==========
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners and admins can delete profiles" ON public.profiles;

CREATE POLICY "Users can view all profiles"
ON public.profiles AS PERMISSIVE
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
ON public.profiles AS PERMISSIVE
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners and admins can delete profiles"
ON public.profiles AS PERMISSIVE
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- ========== leave_requests ==========
DROP POLICY IF EXISTS "Auth users can view leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Teachers/admins can update leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Authenticated users can submit leave requests" ON public.leave_requests;

CREATE POLICY "Auth users can view leave requests"
ON public.leave_requests AS PERMISSIVE
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers/admins can update leave requests"
ON public.leave_requests AS PERMISSIVE
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Authenticated users can submit leave requests"
ON public.leave_requests AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
