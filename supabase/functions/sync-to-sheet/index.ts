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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Authorization check
    const authHeader = req.headers.get('Authorization');
    const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
    const cronSourceHeader = req.headers.get('x-sync-source');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : '';

    const isSchedulerCall = userAgent.includes('pg_net') && cronSourceHeader === 'pg_cron_sync';
    const isCronCall = token === anonKey || isSchedulerCall;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!isCronCall) {
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user: caller }, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !caller) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      const { data: roleRow } = await supabase
        .from('user_roles').select('role').eq('user_id', caller.id).maybeSingle();
      
      if (!roleRow || !['owner', 'admin'].includes(roleRow.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { 
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Read Apps Script URL from system_settings
    const { data: settingRow } = await supabase
      .from('system_settings').select('value').eq('key', 'google_apps_script_url').single();
    
    const appsScriptUrl = settingRow?.value;
    if (!appsScriptUrl) {
      return new Response(
        JSON.stringify({ error: 'google_apps_script_url not configured. Go to Admin Panel > System Settings to set it.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {}
    const { date } = body;
    if (!date) throw new Error('date is required');

    console.log(`Syncing attendance for date: ${date}`);

    const { data: allStudents, error: studentsErr } = await supabase
      .from('students')
      .select('id, roll_no, student_name, curriculum, grade, batch_type, classroom_name, classroom_id, enrollment_status, enrollment_date, center, mobile_number, zone, user_id_vedantu, order_id')
      .order('roll_no');

    if (studentsErr) throw new Error('Failed to fetch students: ' + studentsErr.message);

    const { data: attendanceData, error: attErr } = await supabase
      .from('attendance')
      .select('student_id, status, remark')
      .eq('date', date);

    if (attErr) throw new Error('Failed to fetch attendance: ' + attErr.message);

    const attendanceByStudent: Record<string, any> = {};
    (attendanceData ?? []).forEach((a: any) => {
      attendanceByStudent[a.student_id] = a;
    });

    const enrolledStudents = (allStudents ?? []).filter((s: any) => s.enrollment_status === 'ENROLLED');

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
        status: att ? att.status : '',
        remark: att ? (att.remark || '') : '',
      };
    });

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

    const dateObj = new Date(date + 'T00:00:00');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthLabel = `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    const day = dateObj.getDate().toString().padStart(2, '0');
    const dateLabel = `${day} ${monthNames[dateObj.getMonth()]}`;

    // Sync Master
    console.log(`Syncing master sheet with ${enrolledStudents.length} students...`);
    await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_master', students: enrolledStudents }),
    });

    // Sync Daily Attendance
    console.log(`Syncing daily attendance with ${records.length} records...`);
    await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_attendance', date, records }),
    });

    // Sync Absentees
    console.log(`Syncing absentees: ${absentees.length}...`);
    await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_absentees',
        date,
        date_label: dateLabel,
        month_label: monthLabel,
        absentees,
      }),
    });

    // Sync Analytics
    const presentCount = records.filter((r: any) => r.status === 'P').length;
    const absentCount = records.filter((r: any) => r.status === 'AB').length;
    const leaveCount = records.filter((r: any) => r.status === 'L').length;
    const totalStudents = records.length;
    const attendancePct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

    // Classroom breakdown
    const classroomMap: Record<string, { present: number; absent: number; total: number }> = {};
    records.forEach((r: any) => {
      if (!classroomMap[r.classroom_name]) {
        classroomMap[r.classroom_name] = { present: 0, absent: 0, total: 0 };
      }
      classroomMap[r.classroom_name].total++;
      if (r.status === 'P') classroomMap[r.classroom_name].present++;
      if (r.status === 'AB' || r.status === 'L') classroomMap[r.classroom_name].absent++;
    });

    const classroomBreakdown = Object.entries(classroomMap).map(([classroom, stats]) => ({
      classroom,
      present: stats.present,
      absent: stats.absent,
      pct: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
    }));

    await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_analytics',
        date,
        total_students: totalStudents,
        present_count: presentCount,
        absent_count: absentCount,
        leave_count: leaveCount,
        attendance_pct: attendancePct,
        classroom_breakdown: classroomBreakdown,
      }),
    });

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
