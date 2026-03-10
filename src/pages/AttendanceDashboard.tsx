import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarDays, Save, RefreshCw, Search, Trash2, LayoutGrid, Table,
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
  { value: "P", label: "P", color: "bg-success text-success-foreground", border: "border-success" },
  { value: "AB", label: "AB", color: "bg-destructive text-destructive-foreground", border: "border-destructive" },
  { value: "L", label: "L", color: "bg-warning text-warning-foreground", border: "border-warning" },
  { value: "H", label: "H", color: "bg-purple-600 text-white", border: "border-purple-600" },
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
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    const saved = localStorage.getItem("attendance-view-mode");
    if (saved === "card" || saved === "table") return saved;
    return window.innerWidth < 768 ? "card" : "table";
  });
  const [showUnmarkedOnly, setShowUnmarkedOnly] = useState(false);

  useEffect(() => {
    localStorage.setItem("attendance-view-mode", viewMode);
  }, [viewMode]);

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
      if (showUnmarkedOnly && attendance[s.id]) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.student_name.toLowerCase().includes(q) ||
          s.roll_no.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [students, classroomFilter, gradeFilter, searchQuery, showUnmarkedOnly, attendance]);

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
      }
    } catch (syncErr: any) {
      console.error("Sheet sync error:", syncErr);
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

    const promises: Promise<void>[] = [];

    if (recordsToUpsert.length > 0) {
      promises.push(
        (async () => {
          const { error } = await supabase
            .from("attendance")
            .upsert(recordsToUpsert, { onConflict: "student_id,date" });
          if (error) throw new Error("Failed to save: " + error.message);
        })()
      );
    }

    if (recordsToDelete.length > 0) {
      for (let i = 0; i < recordsToDelete.length; i += 100) {
        const batch = recordsToDelete.slice(i, i + 100);
        promises.push(
          (async () => {
            const { error } = await supabase
              .from("attendance")
              .delete()
              .eq("date", selectedDate)
              .in("student_id", batch);
            if (error) throw new Error("Failed to clear: " + error.message);
          })()
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

    toast.success(`Saved ${recordsToUpsert.length} updates`);
    setSaving(false);
    fetchAttendance();
    syncSheetForDate(selectedDate);
  };

  const handleClearAll = async () => {
    if (!user) return;
    setClearing(true);
    const studentIds = filteredStudents.map((s) => s.id);
    
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
    
    setAttendance((prev) => {
      const updated = { ...prev };
      studentIds.forEach((id) => delete updated[id]);
      return updated;
    });
    setExistingRecords((prev) => prev.filter((r) => !studentIds.includes(r.student_id)));
    
    syncSheetForDate(selectedDate);
    fetchAttendance();
    toast.success(`Cleared attendance for ${studentIds.length} students`);
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
  const markedCount = filteredStudents.filter((s) => attendance[s.id]).length;
  const unmarkedCount = filteredStudents.length - markedCount;
  const progressPct = filteredStudents.length > 0 ? (markedCount / filteredStudents.length) * 100 : 0;

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const existingMap: Record<string, string> = {};
    existingRecords.forEach((r) => { existingMap[r.student_id] = r.status; });
    return Object.entries(attendance).some(([id, status]) => {
      if (status && existingMap[id] !== status) return true;
      return false;
    }) || existingRecords.some((r) => !attendance[r.student_id]);
  }, [attendance, existingRecords]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
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
                    <strong>{format(new Date(selectedDate), "dd MMM yyyy")}</strong>.
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
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="sticky top-[57px] z-10 border-b border-border bg-card/95 backdrop-blur px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            Marked: {markedCount} / {filteredStudents.length}
          </span>
          <Progress value={progressPct} className="flex-1 h-2.5" />
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="text-success">P:{presentCount}</span>
            <span className="text-destructive">AB:{absentCount}</span>
            <span className="text-warning">L:{leaveCount}</span>
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

        {/* Quick actions */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant={showUnmarkedOnly ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setShowUnmarkedOnly(!showUnmarkedOnly)}
          >
            {showUnmarkedOnly ? `Unmarked (${unmarkedCount})` : "Show Unmarked Only"}
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs font-medium text-muted-foreground">Mark all:</span>
          <Button variant="outline" size="sm" onClick={() => handleSetAll("P")} className="text-xs bg-success/10 hover:bg-success/20 text-success border-success/30" disabled={!canEdit}>
            ✓ All Present
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSetAll("AB")} className="text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30" disabled={!canEdit}>
            ✗ All Absent
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-0.5">
            <button
              onClick={() => setViewMode("card")}
              className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === "card" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`rounded px-2 py-1 text-xs transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Table className="h-4 w-4" />
            </button>
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
        ) : viewMode === "card" ? (
          /* Card View */
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredStudents.map((s) => {
              const status = attendance[s.id] || "";
              const statusOpt = STATUS_OPTIONS.find((o) => o.value === status);
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border-2 bg-card p-3 transition-all ${
                    statusOpt ? statusOpt.border : "border-border"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {s.roll_no}
                    </span>
                  </div>
                  <p className="mb-1 text-sm font-semibold text-foreground line-clamp-2 leading-tight">
                    {s.student_name}
                  </p>
                  <p className="mb-3 text-[11px] text-muted-foreground truncate">
                    {s.grade && `Grade ${s.grade}`} · {s.classroom_name}
                  </p>
                  <div className="grid grid-cols-4 gap-1">
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
                        className={`rounded-lg py-2 text-xs font-bold transition-all ${
                          status === opt.value
                            ? opt.color
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        } ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-primary/10">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Roll No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Student Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Grade</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Curriculum</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">Classroom</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-foreground">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, idx) => {
                  const status = attendance[s.id] || "";
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

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          onClick={handleSave}
          disabled={saving || !canEdit}
          className={`rounded-full shadow-lg px-6 ${hasUnsavedChanges ? "animate-pulse" : ""}`}
        >
          <Save className="mr-2 h-5 w-5" />
          {saving ? "Saving..." : "Save All"}
          {hasUnsavedChanges && (
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              !
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AttendanceDashboard;
