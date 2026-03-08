const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKYUpS_BgzI35ehk8rW__fB0f6ZFNv08mn7gY12OKEriycjUgFayjL0KXRm9yMrIT2KXyHe_g4m6YL/pub?gid=0&single=true&output=csv';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
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
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch CSV from Google Sheets
    console.log('Fetching Google Sheet CSV...');
    const csvResponse = await fetch(SHEET_CSV_URL);
    if (!csvResponse.ok) {
      throw new Error(`Failed to fetch sheet: ${csvResponse.status}`);
    }

    const csvText = await csvResponse.text();
    const lines = csvText.split('\n').filter((l) => l.trim());
    
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ success: true, message: 'No data rows found', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse header to find column indices
    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_').replace(/\n/g, '_'));
    
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

    console.log(`Found ${lines.length - 1} data rows`);

    const students: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const rollNo = rollNoIdx >= 0 ? cols[rollNoIdx] : '';
      const name = studentNameIdx >= 0 ? cols[studentNameIdx] : '';
      
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
