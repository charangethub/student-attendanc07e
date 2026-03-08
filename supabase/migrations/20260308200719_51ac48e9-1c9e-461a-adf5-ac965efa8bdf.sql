
-- Students table (synced from Google Sheets)
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center text NOT NULL DEFAULT '',
  roll_no text NOT NULL DEFAULT '',
  student_name text NOT NULL DEFAULT '',
  curriculum text NOT NULL DEFAULT '',
  grade text NOT NULL DEFAULT '',
  batch_type text NOT NULL DEFAULT '',
  classroom_name text NOT NULL DEFAULT '',
  classroom_id text NOT NULL DEFAULT '',
  enrollment_status text NOT NULL DEFAULT '',
  enrollment_date text NOT NULL DEFAULT '',
  mobile_number text NOT NULL DEFAULT '',
  zone text NOT NULL DEFAULT '',
  user_id_vedantu text NOT NULL DEFAULT '',
  order_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(roll_no)
);

-- Attendance table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'P',
  marked_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Students: authenticated users can read
CREATE POLICY "Authenticated users can view students"
  ON public.students FOR SELECT TO authenticated
  USING (true);

-- Students: only owners/admins can insert/update/delete
CREATE POLICY "Owners/admins can manage students"
  ON public.students FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- Attendance: authenticated users can view
CREATE POLICY "Authenticated users can view attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (true);

-- Attendance: teachers/admins/owners can insert
CREATE POLICY "Teachers/admins/owners can insert attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'teacher')
  );

-- Attendance: teachers/admins/owners can update
CREATE POLICY "Teachers/admins/owners can update attendance"
  ON public.attendance FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'teacher')
  );

-- Attendance: only owners/admins can delete
CREATE POLICY "Owners/admins can delete attendance"
  ON public.attendance FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- Update trigger for students
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update trigger for attendance
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for attendance
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
