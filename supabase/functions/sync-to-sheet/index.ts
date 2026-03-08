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

    // 1. Fetch all enrolled students for Master sheet
    const { data: students, error: studentsErr } = await supabase
      .from('students')
      .select('roll_no, student_name, curriculum, grade, classroom_name, enrollment_status, center, mobile_number')
      .eq('enrollment_status', 'ENROLLED')
      .order('roll_no');

    if (studentsErr) throw new Error('Failed to fetch students: ' + studentsErr.message);

    // 2. Fetch attendance for the date
    const { data: attendanceData, error: attErr } = await supabase
      .from('attendance')
      .select('student_id, status, remark')
      .eq('date', date);

    if (attErr) throw new Error('Failed to fetch attendance: ' + attErr.message);

    // 3. Get student details for attendance records
    const studentIds = (attendanceData ?? []).map((a: any) => a.student_id);
    let studentMap: Record<string, any> = {};

    if (studentIds.length > 0) {
      const { data: studentDetails } = await supabase
        .from('students')
        .select('id, roll_no, student_name, grade, classroom_name, mobile_number')
        .in('id', studentIds);

      (studentDetails ?? []).forEach((s: any) => {
        studentMap[s.id] = s;
      });
    }

    // Build attendance records with student info
    const records = (attendanceData ?? []).map((a: any) => {
      const s = studentMap[a.student_id] || {};
      return {
        roll_no: s.roll_no || '',
        student_name: s.student_name || '',
        grade: s.grade || '',
        classroom_name: s.classroom_name || '',
        mobile_number: s.mobile_number || '',
        status: a.status,
        remark: a.remark || '',
      };
    });

    // Build absentees list
    const absentees = records.filter((r: any) => r.status === 'AB' || r.status === 'L');

    // 4. Sync Master sheet
    console.log(`Syncing master sheet with ${(students ?? []).length} students...`);
    const masterRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_master', students: students ?? [] }),
    });
    const masterText = await masterRes.text();
    console.log('Master sync response:', masterText);

    // 5. Sync Daily Attendance
    console.log(`Syncing daily attendance with ${records.length} records...`);
    const attRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_attendance', date, records }),
    });
    const attText = await attRes.text();
    console.log('Attendance sync response:', attText);

    // 6. Sync Absentee Report
    console.log(`Syncing absentee report with ${absentees.length} absentees...`);
    const absRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_absentees', date, absentees }),
    });
    const absText = await absRes.text();
    console.log('Absentee sync response:', absText);

    return new Response(
      JSON.stringify({ success: true, synced: records.length, absentees: absentees.length }),
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
