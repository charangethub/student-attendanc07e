const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const appsScriptUrl = Deno.env.get('GOOGLE_APPS_SCRIPT_URL');
    if (!appsScriptUrl) {
      throw new Error('GOOGLE_APPS_SCRIPT_URL is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { date } = await req.json();
    if (!date) throw new Error('date is required');

    console.log(`Syncing attendance for date: ${date}`);

    // 1. Fetch ALL students
    const { data: allStudents, error: studentsErr } = await supabase
      .from('students')
      .select('id, roll_no, student_name, curriculum, grade, batch_type, classroom_name, classroom_id, enrollment_status, enrollment_date, center, mobile_number, zone, user_id_vedantu, order_id')
      .order('roll_no');

    if (studentsErr) throw new Error('Failed to fetch students: ' + studentsErr.message);

    // Build student lookup by id
    const studentById: Record<string, any> = {};
    (allStudents ?? []).forEach((s: any) => {
      studentById[s.id] = s;
    });

    // 2. Fetch attendance for the date
    const { data: attendanceData, error: attErr } = await supabase
      .from('attendance')
      .select('student_id, status, remark')
      .eq('date', date);

    if (attErr) throw new Error('Failed to fetch attendance: ' + attErr.message);

    // Build attendance lookup by student_id
    const attendanceByStudent: Record<string, any> = {};
    (attendanceData ?? []).forEach((a: any) => {
      attendanceByStudent[a.student_id] = a;
    });

    // Enrolled students only
    const enrolledStudents = (allStudents ?? []).filter((s: any) => s.enrollment_status === 'ENROLLED');

    // 3. Build FULL records for ALL enrolled students (include empty status for students without records)
    // This ensures the sheet OVERWRITES cells — clearing old values when status is removed
    const records = enrolledStudents.map((s: any) => {
      const att = attendanceByStudent[s.id];
      return {
        roll_no: s.roll_no || '',
        student_name: s.student_name || '',
        curriculum: s.curriculum || '',
        grade: s.grade || '',
        classroom_name: s.classroom_name || '',
        enrollment_status: s.enrollment_status || '',
        center: s.center || '',
        mobile_number: s.mobile_number || '',
        status: att ? att.status : '',  // empty string if no record — sheet will clear the cell
        remark: att ? (att.remark || '') : '',
      };
    });

    // Build absentees list (AB and L only) with full details
    const absentees = records
      .filter((r: any) => r.status === 'AB' || r.status === 'L')
      .map((r: any) => ({
        roll_no: r.roll_no,
        student_name: r.student_name,
        curriculum: r.curriculum,
        grade: r.grade,
        classroom_name: r.classroom_name,
        center: r.center,
        mobile_number: r.mobile_number,
        status: r.status,
        remark: r.remark,
      }));

    // Build month label and date label for sheet naming
    const dateObj = new Date(date + 'T00:00:00');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthLabel = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    const day = dateObj.getDate().toString().padStart(2, '0');
    const dateLabel = `${day} ${monthNames[dateObj.getMonth()]}`;

    // 4. Sync Master sheet
    console.log(`Syncing master sheet with ${enrolledStudents.length} students...`);
    const masterRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_master', students: enrolledStudents }),
    });
    const masterText = await masterRes.text();
    console.log('Master sync response:', masterText);

    // 5. Sync Daily Attendance — sends ALL enrolled students so sheet overwrites correctly
    console.log(`Syncing daily attendance with ${records.length} records (${records.filter((r: any) => r.status).length} marked)...`);
    const attRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_attendance', date, records }),
    });
    const attText = await attRes.text();
    console.log('Attendance sync response:', attText);

    // 6. Sync Monthly Absentee Report (date as column in monthly sheet)
    console.log(`Syncing monthly absentee report: ${monthLabel}, date: ${dateLabel}, ${absentees.length} absentees...`);
    const absRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_absentees',
        date,
        date_label: dateLabel,
        month_label: monthLabel,
        students: absenteeStudents,
        absentee_map: absenteeMap,
      }),
    });
    const absText = await absRes.text();
    console.log('Absentee sync response:', absText);

    return new Response(
      JSON.stringify({ success: true, synced: records.filter((r: any) => r.status).length, total: records.length, absentees: absentees.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync to sheet error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
