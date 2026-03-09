const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKYUpS_BgzI35ehk8rW__fB0f6ZFNv08mn7gY12OKEriycjUgFayjL0KXRm9yMrIT2KXyHe_g4m6YL/pub?gid=0&single=true&output=csv';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Parse CSV properly handling quoted fields with newlines
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  const fields: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        fields.push(current.trim());
        current = '';
        if (fields.some(f => f !== '')) {
          rows.push([...fields]);
        }
        fields.length = 0;
      } else {
        current += ch;
      }
    }
  }
  // Last row
  fields.push(current.trim());
  if (fields.some(f => f !== '')) {
    rows.push([...fields]);
  }

  return rows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Authorization check - verify caller has owner or admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const userId = claims.claims.sub;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Verify caller has owner or admin role
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!roleRow || !['owner', 'admin'].includes(roleRow.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden - requires owner or admin role' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Fetching Google Sheet CSV...');
    const csvResponse = await fetch(SHEET_CSV_URL);
    if (!csvResponse.ok) {
      throw new Error(`Failed to fetch sheet: ${csvResponse.status}`);
    }

    const csvText = await csvResponse.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ success: true, message: 'No data rows found', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize headers: lowercase, collapse whitespace/newlines to _
    const headers = rows[0].map((h) =>
      h.toLowerCase().replace(/[\s\n\r]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    );

    console.log('Parsed headers:', JSON.stringify(headers.slice(0, 20)));

    const colIndex = (names: string[]) => {
      for (const name of names) {
        const idx = headers.findIndex((h) => h.includes(name));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const zoneIdx = colIndex(['zone']);
    const centerIdx = colIndex(['center']);
    const userIdVedantuIdx = colIndex(['user_id']);
    const orderIdIdx = colIndex(['order_id']);
    const rollNoIdx = colIndex(['roll_no']);
    const studentNameIdx = colIndex(['student_name']);
    const curriculumIdx = colIndex(['curriculium', 'curriculum']);
    const gradeIdx = colIndex(['grade']);
    const batchTypeIdx = colIndex(['batch_type']);
    const classroomNameIdx = colIndex(['classroom_name']);
    const classroomIdIdx = colIndex(['classroom_id']);
    const enrollmentDateIdx = colIndex(['enrollment_date']);
    const enrollmentStatusIdx = colIndex(['enrollment_status']);
    const mobileIdx = colIndex(['registered_contact_number', 'contact_number', 'mobile']);

    console.log('Column indices:', JSON.stringify({
      rollNo: rollNoIdx, name: studentNameIdx, status: enrollmentStatusIdx, mobile: mobileIdx
    }));
    console.log(`Found ${rows.length - 1} data rows`);

    const students: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const rollNo = rollNoIdx >= 0 ? (cols[rollNoIdx] || '') : '';
      const name = studentNameIdx >= 0 ? (cols[studentNameIdx] || '') : '';

      if (!rollNo || !name) continue;

      students.push({
        zone: zoneIdx >= 0 ? cols[zoneIdx] || '' : '',
        center: centerIdx >= 0 ? cols[centerIdx] || '' : '',
        user_id_vedantu: userIdVedantuIdx >= 0 ? cols[userIdVedantuIdx] || '' : '',
        order_id: orderIdIdx >= 0 ? cols[orderIdIdx] || '' : '',
        roll_no: rollNo,
        student_name: name,
        curriculum: curriculumIdx >= 0 ? cols[curriculumIdx] || '' : '',
        grade: gradeIdx >= 0 ? cols[gradeIdx] || '' : '',
        batch_type: batchTypeIdx >= 0 ? cols[batchTypeIdx] || '' : '',
        classroom_name: classroomNameIdx >= 0 ? cols[classroomNameIdx] || '' : '',
        classroom_id: classroomIdIdx >= 0 ? cols[classroomIdIdx] || '' : '',
        enrollment_date: enrollmentDateIdx >= 0 ? cols[enrollmentDateIdx] || '' : '',
        enrollment_status: enrollmentStatusIdx >= 0 ? cols[enrollmentStatusIdx] || '' : '',
        mobile_number: mobileIdx >= 0 ? cols[mobileIdx] || '' : '',
      });
    }

    // Upsert students by roll_no
    let synced = 0;
    for (const student of students) {
      const { error } = await supabase
        .from('students')
        .upsert(student, { onConflict: 'roll_no' });

      if (error) {
        console.error(`Error upserting ${student.roll_no}:`, error.message);
      } else {
        synced++;
      }
    }

    console.log(`Synced ${synced} students`);

    return new Response(
      JSON.stringify({ success: true, synced, total: students.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
