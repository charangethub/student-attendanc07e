
-- system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All auth can read settings" ON public.system_settings 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage settings" ON public.system_settings 
  FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.system_settings (key, value) VALUES
  ('google_apps_script_url', 'https://script.google.com/macros/s/AKfycbxzq20yTFtjuRGKn-bijlEbn0RyC5pwqRosMSVCTx50JntfQbwydDku-yHusm6jsuSs_A/exec'),
  ('google_sheet_csv_url', ''),
  ('web_app_url', 'https://student-attendanc07e.lovable.app'),
  ('linked_app_url_1', ''), ('linked_app_url_1_label', 'App 1'),
  ('linked_app_url_2', ''), ('linked_app_url_2_label', 'App 2'),
  ('auto_approve_google', 'true'), ('last_sync_at', '')
ON CONFLICT (key) DO NOTHING;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_students_roll_no ON public.students(roll_no);
CREATE INDEX IF NOT EXISTS idx_students_enrollment ON public.students(enrollment_status);
