import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isFuture } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Users } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell,
} from "recharts";

const COLORS = {
  P: "hsl(142, 72%, 40%)",
  AB: "hsl(0, 72%, 51%)",
  L: "hsl(38, 92%, 50%)",
};

type StudentRow = { id: string; classroom_name: string };
type AttendanceRow = { student_id: string; status: string; date: string };

const MonthlyAnalytics = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [attRes, stuRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("student_id, status, date")
          .gte("date", monthStart)
          .lte("date", monthEnd),
        supabase.from("students").select("id, classroom_name").eq("enrollment_status", "ENROLLED"),
      ]);
      setAttendance(attRes.data ?? []);
      setStudents(stuRes.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, [monthStart, monthEnd]);

  // Daily trend data
  const dailyTrend = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
    return days
      .filter((d) => !isFuture(d))
      .map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const dayAtt = attendance.filter((a) => a.date === dateStr);
        const p = dayAtt.filter((a) => a.status === "P").length;
        const ab = dayAtt.filter((a) => a.status === "AB").length;
        const l = dayAtt.filter((a) => a.status === "L").length;
        const total = p + ab + l;
        return {
          date: format(day, "dd"),
          fullDate: format(day, "dd MMM"),
          Present: p,
          Absent: ab,
          Leave: l,
          total,
          presentPct: total ? Math.round((p / total) * 100) : 0,
        };
      });
  }, [attendance, currentMonth]);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const totalRecords = attendance.length;
    const p = attendance.filter((a) => a.status === "P").length;
    const ab = attendance.filter((a) => a.status === "AB").length;
    const l = attendance.filter((a) => a.status === "L").length;
    const daysWithData = new Set(attendance.map((a) => a.date)).size;
    return {
      totalRecords,
      present: p,
      absent: ab,
      leave: l,
      daysTracked: daysWithData,
      avgPresent: totalRecords ? Math.round((p / totalRecords) * 100) : 0,
      avgAbsent: totalRecords ? Math.round((ab / totalRecords) * 100) : 0,
      avgLeave: totalRecords ? Math.round((l / totalRecords) * 100) : 0,
    };
  }, [attendance]);

  // Classroom monthly stats
  const classroomMonthly = useMemo(() => {
    const map: Record<string, { P: number; AB: number; L: number; total: number }> = {};
    students.forEach((s) => {
      const name = s.classroom_name || "Unknown";
      if (!map[name]) map[name] = { P: 0, AB: 0, L: 0, total: 0 };
    });
    attendance.forEach((a) => {
      const stu = students.find((s) => s.id === a.student_id);
      const name = stu?.classroom_name || "Unknown";
      if (!map[name]) map[name] = { P: 0, AB: 0, L: 0, total: 0 };
      map[name].total++;
      if (a.status === "P") map[name].P++;
      else if (a.status === "AB") map[name].AB++;
      else if (a.status === "L") map[name].L++;
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name: name.length > 22 ? name.slice(0, 19) + "…" : name,
        fullName: name,
        presentPct: d.total ? Math.round((d.P / d.total) * 100) : 0,
        absentPct: d.total ? Math.round((d.AB / d.total) * 100) : 0,
        Present: d.P,
        Absent: d.AB,
        Leave: d.L,
        total: d.total,
      }))
      .sort((a, b) => b.presentPct - a.presentPct);
  }, [attendance, students]);

  // Student-level stats: top absentees
  const topAbsentees = useMemo(() => {
    const map: Record<string, { name: string; AB: number; total: number }> = {};
    attendance.forEach((a) => {
      if (!map[a.student_id]) {
        map[a.student_id] = { name: a.student_id, AB: 0, total: 0 };
      }
      map[a.student_id].total++;
      if (a.status === "AB") map[a.student_id].AB++;
    });
    return Object.entries(map)
      .map(([id, d]) => ({ id, ...d, pct: d.total ? Math.round((d.AB / d.total) * 100) : 0 }))
      .filter((d) => d.AB > 0)
      .sort((a, b) => b.AB - a.AB)
      .slice(0, 10);
  }, [attendance]);

  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const nextMonth = () => {
    const next = addMonths(currentMonth, 1);
    if (!isFuture(startOfMonth(next))) setCurrentMonth(next);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Monthly Statistics
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-semibold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            className="h-8 w-8"
            disabled={isFuture(startOfMonth(addMonths(currentMonth, 1)))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Monthly summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Days Tracked</p>
          <p className="text-2xl font-bold text-foreground">{monthlySummary.daysTracked}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Records</p>
          <p className="text-2xl font-bold text-foreground">{monthlySummary.totalRecords}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg Present</p>
          <p className="text-2xl font-bold text-success">{monthlySummary.avgPresent}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg Absent</p>
          <p className="text-2xl font-bold text-destructive">{monthlySummary.avgAbsent}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg Leave</p>
          <p className="text-2xl font-bold text-warning">{monthlySummary.avgLeave}%</p>
        </div>
      </div>

      {/* Daily attendance trend line chart */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Daily Attendance Trend
        </h4>
        {dailyTrend.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No attendance data for this month</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                      <p className="text-xs font-bold text-foreground">{d.fullDate}</p>
                      <p className="text-xs text-success">Present: {d.Present} ({d.presentPct}%)</p>
                      <p className="text-xs text-destructive">Absent: {d.Absent}</p>
                      <p className="text-xs text-warning">Leave: {d.Leave}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="Present" stroke={COLORS.P} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="Absent" stroke={COLORS.AB} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="Leave" stroke={COLORS.L} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Classroom-wise monthly attendance % */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Classroom-wise Monthly Attendance %
        </h4>
        {classroomMonthly.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(250, classroomMonthly.length * 40)}>
            <BarChart data={classroomMonthly} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
                      <p className="text-xs font-bold text-foreground">{d.fullName}</p>
                      <p className="text-xs text-success">Present: {d.Present} ({d.presentPct}%)</p>
                      <p className="text-xs text-destructive">Absent: {d.Absent} ({d.absentPct}%)</p>
                      <p className="text-xs text-warning">Leave: {d.Leave}</p>
                      <p className="text-xs text-muted-foreground">Total records: {d.total}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="presentPct" name="Present %" radius={[0, 4, 4, 0]}>
                {classroomMonthly.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.presentPct >= 80 ? COLORS.P : entry.presentPct >= 60 ? COLORS.L : COLORS.AB}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default MonthlyAnalytics;
