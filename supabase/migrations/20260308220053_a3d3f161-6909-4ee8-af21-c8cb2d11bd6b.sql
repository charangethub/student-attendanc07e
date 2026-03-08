
-- 1. Fix leave_requests: restrict SELECT to teachers/admins/owners only
DROP POLICY IF EXISTS "Auth users can view leave requests" ON public.leave_requests;
CREATE POLICY "Auth users can view leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'teacher'::app_role)
);

-- 2. Fix leave_requests: restrict INSERT with check (keep open for public leave form)
DROP POLICY IF EXISTS "Anyone can submit leave requests" ON public.leave_requests;
CREATE POLICY "Anyone can submit leave requests"
ON public.leave_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 3. Fix profiles: restrict SELECT so users see own profile, owners/admins see all
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Fix attendance: restrict SELECT to teachers/admins/owners
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON public.attendance;
CREATE POLICY "Authenticated users can view attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'teacher'::app_role)
);
