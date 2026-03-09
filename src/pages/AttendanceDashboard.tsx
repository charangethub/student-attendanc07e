import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarDays, Check, X, Clock, Save, RefreshCw, Search, Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

type Student = {
  id: string;
  roll_no: string;
  student_name: string;
  grade: string;
  curriculum: string;
  classroom_name: string;
  enrollment_status: string;
  enrollment_date: string;
  center: string;
  mobile_number: string;
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  date: string;
  status: string;
};

const STATUS_OPTIONS = [
  { value: "P", label: "P", color: "bg-success text-success-foreground" },
  { value: "AB", label: "AB", color: "bg-destructive text-destructive-foreground" },
  { value: "L", label: "L", color: "bg-warning text-warning-foreground" },
  { value: "H", label: "H", color: "bg-purple-600 text-white" },
];

const AttendanceDashboard = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [existingRecords, setExistingRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (students.length > 0) fetchAttendance();
  }, [selectedDate, students]);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("id, roll_no, student_name, grade, curriculum, classroom_name, enrollment_status, enrollment_date, center, mobile_number")
      .eq("enrollment_status", "ENROLLED")
      .order("roll_no");
    if (error) {
      toast.error("Failed to load students");
    } else {
      setStudents(data ?? []);
    }
    setLoading(false);
  };

  const fetchAttendance = async () => {
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("date", selectedDate);
    
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => {
      map[r.student_id] = r.status;
    });
    setAttendance(map);
    setExistingRecords(data ?? []);
  };

  const classrooms = useMemo(
    () => [...new Set(students.map((s) => s.classroom_name).filter(Boolean))].sort(),
    [students]
  );

  const grades = useMemo(
    () => [...new Set(students.map((s) => s.grade).filter(Boolean))].sort(),
    [students]
  );

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (classroomFilter !== "all" && s.classroom_name !== classroomFilter) return false;
      if (gradeFilter !== "all" && s.grade !== gradeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.student_name.toLowerCase().includes(q) ||
          s.roll_no.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [students, classroomFilter, gradeFilter, searchQuery]);

  const handleStatusToggle = (studentId: string) => {
    const current = attendance[studentId] || "";
    const order = ["P", "AB", "L", ""];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    setAttendance((prev) => ({
      ...prev,
      [studentId]: order[nextIdx],
    }));
  };

  const handleSetAll = (status: string) => {
    const map: Record<string, string> = { ...attendance };
    filteredStudents.forEach((s) => {
      map[s.id] = status;
    });
    setAttendance(map);
  };

  const syncSheetForDate = async (date: string) => {
    try {
      const { error: syncError } = await supabase.functions.invoke("sync-to-sheet", {
        body: { date },
      });
      if (syncError) {
        console.error("Sheet sync error:", syncError);
        toast.error("Saved, but Google Sheet sync failed");
      } else {
        toast.success("Google Sheet synced successfully");
      }
    } catch (syncErr: any) {
      console.error("Sheet sync error:", syncErr);
      toast.error("Saved, but Google Sheet sync failed");
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const recordsToUpsert = Object.entries(attendance)
      .filter(([, status]) => status)
      .map(([student_id, status]) => ({
        student_id,
        date: selectedDate,
        status,
        marked_by: user.id,
      }));

    const recordsToDelete = existingRecords
      .filter((r) => !attendance[r.student_id])
      .map((r) => r.student_id);

    if (recordsToUpsert.length === 0 && recordsToDelete.length === 0) {
      toast.error("No changes to save");
      setSaving(false);
      return;
    }

    // Run upsert and delete operations in parallel
    const promises: Promise<any>[] = [];

    if (recordsToUpsert.length > 0) {
      promises.push(
        supabase
          .from("attendance")
          .upsert(recordsToUpsert, { onConflict: "student_id,date" })
          .then(({ error }) => {
            if (error) throw new Error("Failed to save: " + error.message);
          })
      );
    }

    if (recordsToDelete.length > 0) {
      // Batch deletes in parallel too
      for (let i = 0; i < recordsToDelete.length; i += 100) {
        const batch = recordsToDelete.slice(i, i + 100);
        promises.push(
          supabase
            .from("attendance")
            .delete()
            .eq("date", selectedDate)
            .in("student_id", batch)
            .then(({ error }) => {
              if (error) throw new Error("Failed to clear: " + error.message);
            })
        );
      }
    }

    try {
      await Promise.all(promises);
    } catch (err: any) {
      toast.error(err.message);
      setSaving(false);
      return;
    }

    toast.success(`Saved ${recordsToUpsert.length} updates and cleared ${recordsToDelete.length} records`);
    setSaving(false);

    // Fire-and-forget: refresh data and sync sheet in background
    fetchAttendance();
    syncSheetForDate(selectedDate);
  };

  const handleClearAll = async () => {
    if (!user) return;
    setClearing(true);
    const studentIds = filteredStudents.map((s) => s.id);
    
    // Delete in batches of 100
    for (let i = 0; i < studentIds.length; i += 100) {
      const batch = studentIds.slice(i, i + 100);
      const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("date", selectedDate)
        .in("student_id", batch);
      if (error) {
        toast.error("Failed to clear: " + error.message);
        setClearing(false);
        return;
      }
    }
    
    // Clear local state for filtered students
    setAttendance((prev) => {
      const updated = { ...prev };
      studentIds.forEach((id) => delete updated[id]);
      return updated;
    });
    setExistingRecords((prev) => prev.filter((r) => !studentIds.includes(r.student_id)));
    
    await syncSheetForDate(selectedDate);
    await fetchAttendance();
    toast.success(`Cleared attendance for ${studentIds.length} students on ${format(new Date(selectedDate), "dd MMM yyyy")}`);
    setClearing(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-sheet");
      if (error) throw error;
      toast.success(`Synced ${data?.synced ?? 0} students from Google Sheet`);
      fetchStudents();
    } catch (err: any) {
      toast.error("Sync failed: " + (err.message || "Unknown error"));
    }
    setSyncing(false);
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const isNotToday = selectedDate !== today;
  const isOwner = userRole === "owner";
  const canEdit = !isNotToday || isOwner;

  const presentCount = filteredStudents.filter((s) => attendance[s.id] === "P").length;
  const absentCount = filteredStudents.filter((s) => attendance[s.id] === "AB").length;
  const leaveCount = filteredStudents.filter((s) => attendance[s.id] === "L").length;
  const unmarkedCount = filteredStudents.filter((s) => !attendance[s.id]).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

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
              <h1 className="text-lg font-bold text-foreground">Mark Attendance</h1>
              <p className="text-xs text-muted-foreground">{filteredStudents.length} students</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={clearing || existingRecords.length === 0 || !canEdit}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  {clearing ? "Clearing..." : "Clear All"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Attendance?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all attendance records for {filteredStudents.length} filtered students on{" "}
                    <strong>{format(new Date(selectedDate), "dd MMM yyyy")}</strong>. You can then re-mark attendance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Sheet"}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !canEdit}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving..." : "Save All"}
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
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="All Grades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {grades.map((g) => (
                <SelectItem key={g} value={g}>Grade {g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Quick actions & stats */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">Mark all:</span>
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="outline"
              size="sm"
              onClick={() => handleSetAll(opt.value)}
              className="text-xs"
              disabled={!canEdit}
            >
              All {opt.label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-4 text-xs font-medium">
            <span className="text-success">P: {presentCount}</span>
            <span className="text-destructive">AB: {absentCount}</span>
            <span className="text-warning">L: {leaveCount}</span>
            <span className="text-muted-foreground">Unmarked: {unmarkedCount}</span>
          </div>
        </div>
      </div>

      {/* Date warning */}
      {isNotToday && !isOwner && (
        <div className="mx-4 mt-2 rounded-md border border-warning/50 bg-warning/10 px-4 py-2 text-sm text-warning">
          ⚠️ You can only mark attendance for today. Only owners can modify other dates.
        </div>
      )}

      {/* Student List */}
      <div className="px-4 py-2">
        {filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            {students.length === 0
              ? "No students found. Click 'Sync Sheet' to import from Google Sheets."
              : "No students match the current filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-primary/10">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Roll No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Student Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Grade</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Curriculum</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Classroom</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Enrollment</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-foreground">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, idx) => {
                  const status = attendance[s.id] || "";
                  const statusOpt = STATUS_OPTIONS.find((o) => o.value === status);
                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-border ${idx % 2 === 0 ? "bg-card" : "bg-accent/20"}`}
                    >
                      <td className="px-3 py-2 text-xs font-mono text-foreground">{s.roll_no}</td>
                      <td className="px-3 py-2 text-sm font-medium text-foreground">{s.student_name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{s.grade}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{s.curriculum}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{s.classroom_name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{s.enrollment_status}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {STATUS_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              disabled={!canEdit}
                              onClick={() =>
                                setAttendance((prev) => ({
                                  ...prev,
                                  [s.id]: prev[s.id] === opt.value ? "" : opt.value,
                                }))
                              }
                              className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                                status === opt.value
                                  ? opt.color
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
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

export default AttendanceDashboard;
