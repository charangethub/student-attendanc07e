import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";

type Student = {
  id: string;
  classroom_name: string;
  enrollment_status: string;
};

type AttendanceRow = {
  student_id: string;
  status: string;
};

const DailyAttendanceReport = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [stuRes, attRes] = await Promise.all([
        supabase.from("students").select("id, classroom_name, enrollment_status").eq("enrollment_status", "ENROLLED"),
        supabase.from("attendance").select("student_id, status").eq("date", selectedDate),
      ]);
      setStudents(stuRes.data ?? []);
      setAttendance(attRes.data ?? []);
      setLoading(false);
    };
    fetch();
  }, [selectedDate]);

  const reportData = useMemo(() => {
    // Group students by classroom
    const classMap: Record<string, { strength: number; present: number; absent: number; leave: number }> = {};

    students.forEach((s) => {
      const name = s.classroom_name || "Unknown";
      if (!classMap[name]) classMap[name] = { strength: 0, present: 0, absent: 0, leave: 0 };
      classMap[name].strength++;
    });

    attendance.forEach((a) => {
      const stu = students.find((s) => s.id === a.student_id);
      const name = stu?.classroom_name || "Unknown";
      if (!classMap[name]) classMap[name] = { strength: 0, present: 0, absent: 0, leave: 0 };
      if (a.status === "P") classMap[name].present++;
      else if (a.status === "AB") classMap[name].absent++;
      else if (a.status === "L") classMap[name].leave++;
    });

    const rows = Object.entries(classMap)
      .map(([name, d]) => ({
        batch: name,
        strength: d.strength,
        present: d.present,
        absent: d.absent + d.leave,
        pct: d.strength > 0 ? ((d.present / d.strength) * 100) : 0,
      }))
      .sort((a, b) => a.batch.localeCompare(b.batch));

    const totals = rows.reduce(
      (acc, r) => ({
        strength: acc.strength + r.strength,
        present: acc.present + r.present,
        absent: acc.absent + r.absent,
      }),
      { strength: 0, present: 0, absent: 0 }
    );

    return {
      rows,
      totals: {
        ...totals,
        pct: totals.strength > 0 ? ((totals.present / totals.strength) * 100) : 0,
      },
    };
  }, [students, attendance]);

  const dateObj = new Date(selectedDate + "T00:00:00");
  const dateLabel = format(dateObj, "dd/MMM/yyyy");

  const changeDate = (dir: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + dir);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const handlePrint = () => window.print();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          Daily Attendance Report
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <Button variant="outline" size="icon" onClick={() => changeDate(1)} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 print:hidden">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        /* Report card styled like the reference */
        <div className="mx-auto max-w-3xl rounded-xl border-2 border-primary bg-card shadow-lg print:shadow-none print:border print:rounded-none">
          {/* Title header */}
          <div className="border-b-2 border-primary bg-primary/5 px-6 py-4 text-center">
            <h1 className="text-xl font-extrabold tracking-wide text-primary uppercase">
              VEDANTU LEARNING CENTRE
            </h1>
            <p className="text-base font-bold text-destructive">Adilabad</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              DATE&nbsp; {dateLabel}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10 hover:bg-primary/10">
                  <TableHead className="text-center font-bold text-primary uppercase text-xs tracking-wider">Batch</TableHead>
                  <TableHead className="text-center font-bold text-primary uppercase text-xs tracking-wider">Strength</TableHead>
                  <TableHead className="text-center font-bold text-primary uppercase text-xs tracking-wider">Present</TableHead>
                  <TableHead className="text-center font-bold text-primary uppercase text-xs tracking-wider">Absent</TableHead>
                  <TableHead className="text-center font-bold text-primary uppercase text-xs tracking-wider">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No data for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  reportData.rows.map((row, i) => (
                    <TableRow key={row.batch} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                      <TableCell className="text-center font-semibold text-foreground text-sm">{row.batch}</TableCell>
                      <TableCell className="text-center text-foreground">{row.strength}</TableCell>
                      <TableCell className="text-center text-success font-semibold">{row.present}</TableCell>
                      <TableCell className="text-center text-destructive font-semibold">{row.absent}</TableCell>
                      <TableCell className="text-center font-semibold text-foreground">{row.pct.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {reportData.rows.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-primary/10 font-bold hover:bg-primary/10">
                    <TableCell className="text-center text-primary text-sm uppercase">Total</TableCell>
                    <TableCell className="text-center text-foreground">{reportData.totals.strength}</TableCell>
                    <TableCell className="text-center text-success">{reportData.totals.present}</TableCell>
                    <TableCell className="text-center text-destructive">{reportData.totals.absent}</TableCell>
                    <TableCell className="text-center text-foreground">{reportData.totals.pct.toFixed(2)}%</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyAttendanceReport;
