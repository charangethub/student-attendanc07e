-- Fix security + functionality:
-- 1) RLS policies were created as RESTRICTIVE everywhere (no PERMISSIVE policies => effectively blocks all access)
-- 2) Prevent role enumeration via has_role() for arbitrary user_id
-- 3) Ensure new-user provisioning trigger exists

BEGIN;

-- =============================
-- 1) Harden has_role() to prevent role probing of other users
--    Allow checking other users only for owners/admins (needed by some RLS rules)
-- =============================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_is_privileged boolean;
BEGIN
  IF caller IS NULL THEN
    RETURN false;
  END IF;

  IF caller <> _user_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = caller
        AND role IN ('owner'::public.app_role, 'admin'::public.app_role)
    ) INTO caller_is_privileged;

    IF NOT caller_is_privileged THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$;

-- =============================
-- 2) Ensure new users get profile + status rows
-- =============================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =============================
-- 3) Recreate RLS policies as PERMISSIVE (and adjust attendance UPDATE split)
-- =============================

-- ---- attendance ----
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers/admins/owners can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Owners/admins can delete attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers restricted to today for updates" ON public.attendance;
DROP POLICY IF EXISTS "Owners/admins can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can update today's attendance" ON public.attendance;

CREATE POLICY "Authenticated users can view attendance"
ON public.attendance AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'teacher'::public.app_role)
);

CREATE POLICY "Teachers/admins/owners can insert attendance"
ON public.attendance AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'teacher'::public.app_role)
);

CREATE POLICY "Owners/admins can delete attendance"
ON public.attendance AS PERMISSIVE
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Owners/admins can update attendance"
ON public.attendance AS PERMISSIVE
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Teachers can update today's attendance"
ON public.attendance AS PERMISSIVE
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::public.app_role)
  AND date = CURRENT_DATE
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::public.app_role)
  AND date = CURRENT_DATE
);

-- ---- leave_requests ----
DROP POLICY IF EXISTS "Auth users can view leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Authenticated users can submit leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Admins/owners can update leave requests" ON public.leave_requests;

CREATE POLICY "Auth users can view leave requests"
ON public.leave_requests AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'teacher'::public.app_role)
);

CREATE POLICY "Authenticated users can submit leave requests"
ON public.leave_requests AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);

CREATE POLICY "Admins/owners can update leave requests"
ON public.leave_requests AS PERMISSIVE
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
);

-- ---- page_access ----
DROP POLICY IF EXISTS "Users can view own page access" ON public.page_access;
DROP POLICY IF EXISTS "Owners/admins can manage page access" ON public.page_access;

CREATE POLICY "Users can view own page access"
ON public.page_access AS PERMISSIVE
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can manage page access"
ON public.page_access AS PERMISSIVE
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
);

-- ---- profiles ----
DROP POLICY IF EXISTS "Owners and admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Owners and admins can delete profiles"
ON public.profiles AS PERMISSIVE
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can view all profiles"
ON public.profiles AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can update own profile"
ON public.profiles AS PERMISSIVE
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ---- students ----
DROP POLICY IF EXISTS "Owners/admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Approved users can view students" ON public.students;

CREATE POLICY "Owners/admins can manage students"
ON public.students AS PERMISSIVE
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Approved users can view students"
ON public.students AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'teacher'::public.app_role)
);

-- ---- user_roles ----
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Owners/admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners/admins can delete roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
ON public.user_roles AS PERMISSIVE
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can view all roles"
ON public.user_roles AS PERMISSIVE
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Owners can insert roles"
ON public.user_roles AS PERMISSIVE
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Owners can update roles"
ON public.user_roles AS PERMISSIVE
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::public.app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::public.app_role));

-- Keep the previously-fixed anti-privilege-stripping logic
CREATE POLICY "Owners/admins can delete roles"
ON public.user_roles AS PERMISSIVE
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR (
    has_role(auth.uid(), 'admin'::public.app_role)
    AND NOT has_role(user_id, 'owner'::public.app_role)
  )
);

-- ---- user_status ----
DROP POLICY IF EXISTS "Users can view own status" ON public.user_status;
DROP POLICY IF EXISTS "Owners/admins can manage status" ON public.user_status;

CREATE POLICY "Users can view own status"
ON public.user_status AS PERMISSIVE
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners/admins can manage status"
ON public.user_status AS PERMISSIVE
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'owner'::public.app_role)
  OR has_role(auth.uid(), 'admin'::public.app_role)
);

COMMIT;