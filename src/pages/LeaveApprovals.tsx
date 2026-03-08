import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, MessageCircle, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LeaveRequest = {
  id: string;
  student_name: string;
  classroom_name: string;
  grade: string;
  roll_no: string;
  email: string;
  mobile_number: string;
  leave_start_date: string;
  leave_end_date: string;
  reason: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-warning/10 text-warning border-warning/30", icon: Clock },
  approved: { label: "Approved", color: "bg-success/10 text-success border-success/30", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
};

const LeaveApprovals = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load leave requests");
    } else {
      setRequests((data as LeaveRequest[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("leave_requests_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        fetchRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const sendWhatsApp = (phone: string, message: string) => {
    const cleaned = phone.replace(/[^0-9]/g, "");
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const handleApprove = async (req: LeaveRequest) => {
    setProcessing(req.id);
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);

    if (error) {
      toast.error("Failed to approve");
    } else {
      toast.success(`Leave approved for ${req.student_name}`);
      const msg = `✅ Your leave request from ${req.leave_start_date} to ${req.leave_end_date} has been APPROVED. - Vedantu Attendance`;
      
      // Open WhatsApp
      if (req.mobile_number) sendWhatsApp(req.mobile_number, msg);
      
      // Show email option
      if (req.email) {
        const mailUrl = `mailto:${req.email}?subject=${encodeURIComponent("Leave Request Approved")}&body=${encodeURIComponent(msg)}`;
        window.open(mailUrl, "_blank");
      }
    }
    setProcessing(null);
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    const req = requests.find((r) => r.id === rejectDialog);
    if (!req) return;

    setProcessing(req.id);
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason || "No reason provided",
      })
      .eq("id", req.id);

    if (error) {
      toast.error("Failed to reject");
    } else {
      toast.success(`Leave rejected for ${req.student_name}`);
      const msg = `❌ Your leave request from ${req.leave_start_date} to ${req.leave_end_date} has been REJECTED. Reason: ${rejectionReason || "No reason provided"}. - Vedantu Attendance`;
      
      if (req.mobile_number) sendWhatsApp(req.mobile_number, msg);
      if (req.email) {
        const mailUrl = `mailto:${req.email}?subject=${encodeURIComponent("Leave Request Rejected")}&body=${encodeURIComponent(msg)}`;
        window.open(mailUrl, "_blank");
      }
    }
    setRejectDialog(null);
    setRejectionReason("");
    setProcessing(null);
  };

  const counts = {
    pending: requests.length, // when filter is pending this shows correctly
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leave Approvals</h1>
          <p className="text-sm text-muted-foreground">Review and manage student leave requests</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No {filter !== "all" ? filter : ""} leave requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => {
            const config = statusConfig[req.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <Card key={req.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-foreground">{req.student_name}</h3>
                        <Badge variant="outline" className={config.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                        {req.classroom_name && <p>Classroom: <span className="text-foreground">{req.classroom_name}</span></p>}
                        {req.grade && <p>Grade: <span className="text-foreground">{req.grade}</span></p>}
                        {req.roll_no && <p>Roll No: <span className="text-foreground">{req.roll_no}</span></p>}
                        <p>From: <span className="text-foreground">{req.leave_start_date}</span></p>
                        <p>To: <span className="text-foreground">{req.leave_end_date}</span></p>
                        <p>Submitted: <span className="text-foreground">{format(new Date(req.created_at), "dd MMM yyyy, hh:mm a")}</span></p>
                      </div>
                      <p className="text-sm"><span className="text-muted-foreground">Reason:</span> <span className="text-foreground">{req.reason}</span></p>
                      {req.rejection_reason && (
                        <p className="text-sm text-destructive">Rejection reason: {req.rejection_reason}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {req.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{req.email}</span>}
                        {req.mobile_number && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{req.mobile_number}</span>}
                      </div>
                    </div>

                    {req.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(req)}
                          disabled={processing === req.id}
                          className="bg-success hover:bg-success/90 text-success-foreground"
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setRejectDialog(req.id)}
                          disabled={processing === req.id}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectionReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>Provide a reason for rejection (will be sent to the student)</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection..."
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectionReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!processing}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveApprovals;
