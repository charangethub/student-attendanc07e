
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  classroom_name text NOT NULL DEFAULT '',
  grade text NOT NULL DEFAULT '',
  roll_no text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  mobile_number text NOT NULL DEFAULT '',
  leave_start_date date NOT NULL,
  leave_end_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public form)
CREATE POLICY "Anyone can submit leave requests"
ON public.leave_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Authenticated admin/teacher/owner can view
CREATE POLICY "Auth users can view leave requests"
ON public.leave_requests FOR SELECT
TO authenticated
USING (true);

-- Admin/teacher/owner can update (approve/reject)
CREATE POLICY "Teachers/admins can update leave requests"
ON public.leave_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
