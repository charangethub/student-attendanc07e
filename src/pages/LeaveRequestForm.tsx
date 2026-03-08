import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FileText, CheckCircle } from "lucide-react";

const LeaveRequestForm = () => {
  const [classrooms, setClassrooms] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    student_name: "",
    classroom_name: "",
    grade: "",
    roll_no: "",
    email: "",
    mobile_number: "",
    leave_start_date: "",
    leave_end_date: "",
    reason: "",
  });

  useEffect(() => {
    const fetchClassrooms = async () => {
      const { data } = await supabase
        .from("students")
        .select("classroom_name")
        .neq("classroom_name", "");
      if (data) {
        const unique = [...new Set(data.map((s) => s.classroom_name))].sort();
        setClassrooms(unique);
      }
    };
    fetchClassrooms();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_name || !form.email || !form.mobile_number || !form.leave_start_date || !form.leave_end_date || !form.reason) {
      toast.error("Please fill all required fields");
      return;
    }
    if (form.leave_end_date < form.leave_start_date) {
      toast.error("End date must be after start date");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("leave_requests").insert({
      student_name: form.student_name.trim(),
      classroom_name: form.classroom_name,
      grade: form.grade.trim(),
      roll_no: form.roll_no.trim(),
      email: form.email.trim(),
      mobile_number: form.mobile_number.trim(),
      leave_start_date: form.leave_start_date,
      leave_end_date: form.leave_end_date,
      reason: form.reason.trim(),
    });
    setLoading(false);

    if (error) {
      toast.error("Failed to submit: " + error.message);
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <CheckCircle className="mx-auto h-16 w-16 text-success mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Leave Request Submitted!</h2>
            <p className="text-muted-foreground">
              Your leave request has been submitted successfully. You will be notified via email and WhatsApp once it is reviewed.
            </p>
            <Button className="mt-6" onClick={() => { setSubmitted(false); setForm({ student_name: "", classroom_name: "", grade: "", roll_no: "", email: "", mobile_number: "", leave_start_date: "", leave_end_date: "", reason: "" }); }}>
              Submit Another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Leave Request Form</CardTitle>
          <CardDescription>Fill in the details to request leave</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="student_name">Student Name *</Label>
                <Input id="student_name" value={form.student_name} onChange={(e) => handleChange("student_name", e.target.value)} required maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roll_no">Roll No</Label>
                <Input id="roll_no" value={form.roll_no} onChange={(e) => handleChange("roll_no", e.target.value)} maxLength={50} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="classroom">Classroom</Label>
                <Select value={form.classroom_name} onValueChange={(v) => handleChange("classroom_name", v)}>
                  <SelectTrigger><SelectValue placeholder="Select classroom" /></SelectTrigger>
                  <SelectContent>
                    {classrooms.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade</Label>
                <Input id="grade" value={form.grade} onChange={(e) => handleChange("grade", e.target.value)} maxLength={20} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} required maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile/WhatsApp Number *</Label>
                <Input id="mobile" value={form.mobile_number} onChange={(e) => handleChange("mobile_number", e.target.value)} required maxLength={15} placeholder="+91XXXXXXXXXX" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Leave Start Date *</Label>
                <Input id="start_date" type="date" value={form.leave_start_date} onChange={(e) => handleChange("leave_start_date", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Leave End Date *</Label>
                <Input id="end_date" type="date" value={form.leave_end_date} onChange={(e) => handleChange("leave_end_date", e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Leave *</Label>
              <Textarea id="reason" value={form.reason} onChange={(e) => handleChange("reason", e.target.value)} required maxLength={1000} rows={3} placeholder="Please describe the reason for leave..." />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Leave Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaveRequestForm;
