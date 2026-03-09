
-- Fix user_roles SELECT policies: drop restrictive, create permissive
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Owners/admins can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix user_roles INSERT policy: allow admins too
DROP POLICY IF EXISTS "Owners can insert roles" ON public.user_roles;

CREATE POLICY "Owners/admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix user_roles UPDATE policy: allow admins too (not owner roles)
DROP POLICY IF EXISTS "Owners can update roles" ON public.user_roles;

CREATE POLICY "Owners/admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR (has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(user_id, 'owner'::app_role)))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR (has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(user_id, 'owner'::app_role)));

-- Fix attendance SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON public.attendance;

CREATE POLICY "Authenticated users can view attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- Fix attendance INSERT policy
DROP POLICY IF EXISTS "Teachers/admins/owners can insert attendance" ON public.attendance;

CREATE POLICY "Teachers/admins/owners can insert attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- Fix attendance UPDATE policies
DROP POLICY IF EXISTS "Owners/admins can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can update today's attendance" ON public.attendance;

CREATE POLICY "Owners/admins can update attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can update today attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role) AND date = CURRENT_DATE)
  WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND date = CURRENT_DATE);

-- Fix attendance DELETE policy
DROP POLICY IF EXISTS "Owners/admins can delete attendance" ON public.attendance;

CREATE POLICY "Owners/admins can delete attendance" ON public.attendance
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix students SELECT policies
DROP POLICY IF EXISTS "Owners/admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Approved users can view students" ON public.students;

CREATE POLICY "Owners/admins can manage students" ON public.students
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view students" ON public.students
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- Fix profiles SELECT policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners and admins can delete profiles" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners and admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix user_status policies
DROP POLICY IF EXISTS "Users can view own status" ON public.user_status;
DROP POLICY IF EXISTS "Owners/admins can manage status" ON public.user_status;

CREATE POLICY "Users can view own status" ON public.user_status
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can manage status" ON public.user_status
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix page_access policies
DROP POLICY IF EXISTS "Users can view own page access" ON public.page_access;
DROP POLICY IF EXISTS "Owners/admins can manage page access" ON public.page_access;

CREATE POLICY "Users can view own page access" ON public.page_access
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can manage page access" ON public.page_access
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix leave_requests policies
DROP POLICY IF EXISTS "Owners/admins/teachers can submit leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Auth users can view leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins/owners can update leave requests" ON public.leave_requests;

CREATE POLICY "Owners/admins/teachers can submit leave requests" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)) AND submitted_by = auth.uid() AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);

CREATE POLICY "Auth users can view leave requests" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Admins/owners can update leave requests" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
