
-- 1. Add admin_panel_access column to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS admin_panel_access boolean NOT NULL DEFAULT false;

-- 2. Update handle_new_user function to also create role & status, with auto-approve check
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name text;
  v_email text;
  v_auto_approve text;
  v_initial_status text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_email := COALESCE(NEW.email, '');

  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, v_full_name, v_email)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert role (default: teacher)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher')
  ON CONFLICT (user_id) DO NOTHING;

  -- Check auto-approve setting
  SELECT value INTO v_auto_approve FROM public.system_settings WHERE key = 'auto_approve_google';
  v_initial_status := CASE WHEN v_auto_approve = 'true' THEN 'active' ELSE 'pending' END;

  -- Insert status
  INSERT INTO public.user_status (user_id, status)
  VALUES (NEW.id, v_initial_status)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- 3. Delete students with empty roll_no
DELETE FROM public.students WHERE trim(roll_no) = '';

-- 4. Update google_sheet_csv_url default
INSERT INTO public.system_settings (key, value)
VALUES ('google_sheet_csv_url', 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRnK41rs9WkGF4BRilDfihl40NKkhoQjj244tHxk-q8dO7pzc9T_pdOdw72PWOdPCIH-ehOR2DgUEWi/pub?gid=1006706135&single=true&output=csv')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 5. Insert sync_interval_minutes setting
INSERT INTO public.system_settings (key, value)
VALUES ('sync_interval_minutes', '1')
ON CONFLICT (key) DO NOTHING;
