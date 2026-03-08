import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

type Student = {
  id: string;
  roll_no: string;
  student_name: string;
  grade: string;
  curriculum: string;
  classroom_name: string;
  enrollment_status: string;
};

type AttendanceMap = Record<string, Record<string, string>>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const AttendanceRecords = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [enrollmentFilter, setEnrollmentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [loading, setLoading] = useState(true);

  const monthStart = useMemo(
    () => startOfMonth(new Date(selectedYear, selectedMonth)),
    [selectedMonth, selectedYear]
  );
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);
  const daysInMonth = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd]
  );

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    const startDate = format(monthStart, "yyyy-MM-dd");
    const endDate = format(monthEnd, "yyyy-MM-dd");

    const [studentsRes, attendanceRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, roll_no, student_name, grade, curriculum, classroom_name, enrollment_status")
        .order("roll_no"),
      supabase
        .from("attendance")
        .select("student_id, date, status")
        .gte("date", startDate)
        .lte("date", endDate),
    ]);

    setStudents(studentsRes.data ?? []);

    const map: AttendanceMap = {};
    (attendanceRes.data ?? []).forEach((r: any) => {
      if (!map[r.student_id]) map[r.student_id] = {};
      map[r.student_id][r.date] = r.status;
    });
    setAttendanceMap(map);
    setLoading(false);
  };

  const classrooms = useMemo(
    () => [...new Set(students.map((s) => s.classroom_name).filter(Boolean))].sort(),
    [students]
  );

  const enrollmentStatuses = useMemo(
    () => [...new Set(students.map((s) => s.enrollment_status).filter(Boolean))].sort(),
    [students]
  );

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (classroomFilter !== "all" && s.classroom_name !== classroomFilter) return false;
      if (enrollmentFilter !== "all" && s.enrollment_status !== enrollmentFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.student_name.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q);
      }
      return true;
    });
  }, [students, classroomFilter, enrollmentFilter, searchQuery]);

  const getStudentStats = (studentId: string) => {
    const records = attendanceMap[studentId] || {};
    let p = 0, ab = 0, l = 0, h = 0;
    Object.values(records).forEach((s) => {
      if (s === "P") p++;
      else if (s === "AB") ab++;
      else if (s === "L") l++;
      else if (s === "H") h++;
    });
    const totalDays = daysInMonth.length;
    const workingDays = totalDays - h;
    const pct = workingDays > 0 ? Math.round((p / workingDays) * 100) : 0;
    return { p, ab, l, h, totalDays, workingDays, pct };
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No data to export");
      return;
    }
    const dateHeaders = daysInMonth.map((d) => format(d, "dd"));
    const headers = ["Roll No", "Student Name", "Curriculum", "Classroom", "Grade", "Enrollment Status", ...dateHeaders, "P", "AB", "L", "H", "Total Days", "%"];
    const rows = filtered.map((s) => {
      const stats = getStudentStats(s.id);
      const dayStatuses = daysInMonth.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        return attendanceMap[s.id]?.[dateStr] || "";
      });
      return [s.roll_no, s.student_name, s.curriculum, s.classroom_name, s.grade, s.enrollment_status, ...dayStatuses, stats.p, stats.ab, stats.l, stats.h, stats.workingDays, stats.totalDays, stats.pct + "%"];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${MONTHS[selectedMonth]}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Attendance Records</h1>
            <p className="text-xs text-muted-foreground">
              {MONTHS[selectedMonth]} {selectedYear} • {filtered.length} students
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-border bg-card/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={classroomFilter} onValueChange={setClassroomFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Classrooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classrooms</SelectItem>
              {classrooms.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={enrollmentFilter} onValueChange={setEnrollmentFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Enrollment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Enrollment</SelectItem>
              {enrollmentStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Records table */}
      <div className="px-4 py-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-primary/10">
                  <th className="sticky left-0 z-[5] bg-primary/10 px-2 py-2 text-left font-semibold">Roll No</th>
                  <th className="sticky left-[70px] z-[5] bg-primary/10 px-2 py-2 text-left font-semibold min-w-[140px]">Name</th>
                  <th className="px-2 py-2 text-left font-semibold min-w-[90px]">Curriculum</th>
                  <th className="px-2 py-2 text-left font-semibold min-w-[60px]">Grade</th>
                  <th className="px-2 py-2 text-left font-semibold min-w-[120px]">Classroom</th>
                  <th className="px-2 py-2 text-center font-semibold min-w-[80px]">Status</th>
                  {daysInMonth.map((d) => (
                    <th key={d.toISOString()} className="px-1 py-2 text-center font-semibold min-w-[28px]">
                      {format(d, "dd")}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold bg-success/10">P</th>
                  <th className="px-2 py-2 text-center font-semibold bg-destructive/10">AB</th>
                  <th className="px-2 py-2 text-center font-semibold bg-warning/10">L</th>
                  <th className="px-2 py-2 text-center font-semibold bg-purple-600/10">H</th>
                  <th className="px-2 py-2 text-center font-semibold">Working</th>
                  <th className="px-2 py-2 text-center font-semibold">Total</th>
                  <th className="px-2 py-2 text-center font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => {
                  const stats = getStudentStats(s.id);
                  const isForfeited = s.enrollment_status?.toUpperCase() === "FORFEITED";
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-border ${idx % 2 === 0 ? "bg-card" : "bg-accent/20"}`}
                    >
                      <td className="sticky left-0 z-[4] bg-inherit px-2 py-1.5 font-mono">{s.roll_no}</td>
                      <td className="sticky left-[70px] z-[4] bg-inherit px-2 py-1.5 font-medium truncate max-w-[140px]">{s.student_name}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{s.curriculum}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{s.grade}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{s.classroom_name}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          isForfeited
                            ? "bg-destructive/15 text-destructive"
                            : "bg-success/15 text-success"
                        }`}>
                          {s.enrollment_status}
                        </span>
                      </td>
                      {daysInMonth.map((d) => {
                        const dateStr = format(d, "yyyy-MM-dd");
                        const status = attendanceMap[s.id]?.[dateStr] || "";
                        return (
                          <td key={dateStr} className="px-0.5 py-1.5 text-center">
                            {status ? (
                              <span
                                className={`inline-block w-6 rounded text-[10px] font-bold ${
                                  status === "P"
                                    ? "bg-success/20 text-success"
                                    : status === "AB"
                                    ? "bg-destructive/20 text-destructive"
                                    : status === "H"
                                    ? "bg-purple-600/20 text-purple-600"
                                    : "bg-warning/20 text-warning"
                                }`}
                              >
                                {status}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center font-bold text-success">{stats.p}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-destructive">{stats.ab}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-warning">{stats.l}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-purple-600">{stats.h}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-muted-foreground">{stats.workingDays}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-muted-foreground">{stats.totalDays}</td>
                      <td className={`px-2 py-1.5 text-center font-bold ${stats.pct >= 75 ? "text-success" : stats.pct >= 50 ? "text-warning" : "text-destructive"}`}>
                        {stats.pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceRecords;
