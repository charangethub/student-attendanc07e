import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, MessageCircle, CalendarDays, Search } from "lucide-react";
import { format } from "date-fns";

type AbsenteeRow = {
  student_id: string;
  roll_no: string;
  student_name: string;
  grade: string;
  curriculum: string;
  classroom_name: string;
  center: string;
  mobile_number: string;
  status: string;
};

const AbsenteeDashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [absentees, setAbsentees] = useState<AbsenteeRow[]>([]);
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAbsentees();
  }, [selectedDate]);

  const fetchAbsentees = async () => {
    setLoading(true);
    // Get all attendance records for the date with status AB or L
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("date", selectedDate)
      .in("status", ["AB", "L"]);

    if (!attendanceData || attendanceData.length === 0) {
      setAbsentees([]);
      setLoading(false);
      return;
    }

    const studentIds = attendanceData.map((a) => a.student_id);
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, roll_no, student_name, grade, curriculum, classroom_name, center, mobile_number")
      .in("id", studentIds);

    const rows: AbsenteeRow[] = (studentsData ?? []).map((s: any) => {
      const att = attendanceData.find((a) => a.student_id === s.id);
      return {
        student_id: s.id,
        roll_no: s.roll_no,
        student_name: s.student_name,
        grade: s.grade,
        curriculum: s.curriculum,
        classroom_name: s.classroom_name,
        center: s.center,
        mobile_number: s.mobile_number,
        status: att?.status ?? "AB",
      };
    });

    setAbsentees(rows);
    setLoading(false);
  };

  const classrooms = useMemo(
    () => [...new Set(absentees.map((a) => a.classroom_name).filter(Boolean))].sort(),
    [absentees]
  );

  const filtered = useMemo(() => {
    return absentees.filter((a) => {
      if (classroomFilter !== "all" && a.classroom_name !== classroomFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.student_name.toLowerCase().includes(q) || a.roll_no.toLowerCase().includes(q);
      }
      return true;
    });
  }, [absentees, classroomFilter, searchQuery]);

  const sendWhatsApp = (mobile: string, name: string, date: string) => {
    const cleanMobile = mobile.replace(/\D/g, "");
    const phoneNumber = cleanMobile.startsWith("91") ? cleanMobile : `91${cleanMobile}`;
    const message = encodeURIComponent(
      `Dear Parent,\n\nThis is to inform you that your ward *${name}* was marked *absent* on *${format(new Date(date), "dd MMM yyyy")}* at Vedantu Learning Centre.\n\nPlease contact the centre for any queries.\n\nRegards,\nVedantu Attendance Team`
    );
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = ["Roll No", "Student Name", "Grade", "Curriculum", "Classroom", "Center", "Mobile", "Status"];
    const rows = filtered.map((a) => [
      a.roll_no, a.student_name, a.grade, a.curriculum, a.classroom_name, a.center, a.mobile_number, a.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `absentees_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Daily Absentee Report</h1>
              <p className="text-xs text-muted-foreground">{filtered.length} absent/on leave</p>
            </div>
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
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
          </div>
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

      {/* List */}
      <div className="px-4 py-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            No absentees found for {format(new Date(selectedDate), "dd MMM yyyy")}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-destructive/10">
                  <th className="px-3 py-2 text-left text-xs font-semibold">Roll No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Student Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Grade</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Classroom</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Mobile</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold">Status</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, idx) => (
                  <tr
                    key={a.student_id}
                    className={`border-b border-border ${idx % 2 === 0 ? "bg-card" : "bg-accent/20"}`}
                  >
                    <td className="px-3 py-2 text-xs font-mono">{a.roll_no}</td>
                    <td className="px-3 py-2 text-sm font-medium">{a.student_name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{a.grade}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate">{a.classroom_name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{a.mobile_number}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-bold ${
                          a.status === "AB"
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-warning text-warning-foreground"
                        }`}
                      >
                        {a.status === "AB" ? "Absent" : "Leave"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {a.mobile_number ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => sendWhatsApp(a.mobile_number, a.student_name, selectedDate)}
                        >
                          <MessageCircle className="mr-1 h-3 w-3 text-success" />
                          Send
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No number</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AbsenteeDashboard;
