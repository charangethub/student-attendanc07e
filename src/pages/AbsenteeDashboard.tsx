import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, MessageCircle, CalendarDays, Search, Save } from "lucide-react";
import { format } from "date-fns";

type AbsenteeRow = {
  student_id: string;
  attendance_id: string;
  roll_no: string;
  student_name: string;
  grade: string;
  curriculum: string;
  classroom_name: string;
  center: string;
  mobile_number: string;
  status: string;
  remark: string;
};

const AbsenteeDashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [absentees, setAbsentees] = useState<AbsenteeRow[]>([]);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRemarks, setSavingRemarks] = useState(false);

  useEffect(() => {
    fetchAbsentees();
  }, [selectedDate]);

  const fetchAbsentees = async () => {
    setLoading(true);
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("id, student_id, status, remark")
      .eq("date", selectedDate)
      .in("status", ["AB", "L"]);

    if (!attendanceData || attendanceData.length === 0) {
      setAbsentees([]);
      setRemarks({});
      setLoading(false);
      return;
    }

    const studentIds = attendanceData.map((a: any) => a.student_id);
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, roll_no, student_name, grade, curriculum, classroom_name, center, mobile_number")
      .in("id", studentIds);

    const remarkMap: Record<string, string> = {};
    const rows: AbsenteeRow[] = (studentsData ?? []).map((s: any) => {
      const att = attendanceData.find((a: any) => a.student_id === s.id);
      remarkMap[att?.id ?? ""] = (att as any)?.remark ?? "";
      return {
        student_id: s.id,
        attendance_id: att?.id ?? "",
        roll_no: s.roll_no,
        student_name: s.student_name,
        grade: s.grade,
        curriculum: s.curriculum,
        classroom_name: s.classroom_name,
        center: s.center,
        mobile_number: s.mobile_number,
        status: att?.status ?? "AB",
        remark: (att as any)?.remark ?? "",
      };
    });

    setAbsentees(rows);
    setRemarks(remarkMap);
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

  const handleRemarkChange = (attendanceId: string, value: string) => {
    setRemarks((prev) => ({ ...prev, [attendanceId]: value }));
  };

  const handleSaveRemarks = async () => {
    setSavingRemarks(true);
    const updates = Object.entries(remarks).filter(([id]) => id);
    
    try {
      await Promise.all(
        updates.map(([id, remark]) =>
          supabase.from("attendance").update({ remark } as any).eq("id", id).then(({ error }) => {
            if (error) throw error;
          })
        )
      );
      toast.success("Remarks saved successfully");
      try {
        await supabase.functions.invoke("sync-to-sheet", {
          body: { date: selectedDate },
        });
        toast.success("Google Sheet synced");
      } catch (e) {
        console.error("Sheet sync error:", e);
      }
    } catch (err: any) {
      toast.error("Failed to save remarks: " + err.message);
    }
    setSavingRemarks(false);
  };

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
    const headers = ["Roll No", "Student Name", "Grade", "Curriculum", "Classroom", "Center", "Mobile", "Status", "Remark"];
    const rows = filtered.map((a) => [
      a.roll_no, a.student_name, a.grade, a.curriculum, a.classroom_name, a.center, a.mobile_number, a.status, remarks[a.attendance_id] ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveRemarks} disabled={savingRemarks}>
              <Save className="mr-1 h-4 w-4" />
              {savingRemarks ? "Saving..." : "Save Remarks"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
          </div>
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
                  <th className="px-3 py-2 text-left text-xs font-semibold min-w-[250px]">Remark</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, idx) => (
                  <tr
                    key={a.attendance_id}
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
                    <td className="px-3 py-2">
                      <Textarea
                        placeholder="Enter reason for absence..."
                        value={remarks[a.attendance_id] ?? ""}
                        onChange={(e) => handleRemarkChange(a.attendance_id, e.target.value)}
                        className="min-h-[60px] text-xs resize-y"
                        rows={2}
                      />
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
