import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Crown, Plus, Save, Trash2, UserCheck } from "lucide-react";

const PAGE_OPTIONS = [
  "Dashboard",
  "Mark Attendance",
  "Absentee Report",
  "Attendance Records",
];

const ROLE_OPTIONS = ["admin", "teacher"];

interface UserData {
  user_id: string;
  full_name: string;
  email: string;
  role: string | null;
  status: string;
  pageAccess: Record<string, boolean>;
}

const AdminPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    const { data: statuses } = await supabase.from("user_status").select("*");
    const { data: access } = await supabase.from("page_access").select("*");

    const usersMap: UserData[] = (profiles ?? []).map((p) => {
      const role = roles?.find((r) => r.user_id === p.user_id);
      const status = statuses?.find((s) => s.user_id === p.user_id);
      const userAccess: Record<string, boolean> = {};
      PAGE_OPTIONS.forEach((page) => {
        const a = access?.find((ac) => ac.user_id === p.user_id && ac.page_name === page);
        userAccess[page] = a?.has_access ?? false;
      });
      return {
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        role: role?.role ?? null,
        status: status?.status ?? "pending",
        pageAccess: userAccess,
      };
    });

    setUsers(usersMap);
    setLoading(false);
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, role: newRole === "none" ? null : newRole } : u))
    );
  };

  const handleStatusChange = (userId: string, newStatus: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, status: newStatus } : u))
    );
  };

  const handleAccessChange = (userId: string, page: string, checked: boolean) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === userId
          ? { ...u, pageAccess: { ...u.pageAccess, [page]: checked } }
          : u
      )
    );
  };

  const handleSave = async (userData: UserData) => {
    // Save role
    if (userData.role) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: userData.user_id, role: userData.role as any }, { onConflict: "user_id" });
      if (roleError) {
        toast.error("Failed to save role: " + roleError.message);
        return;
      }
    } else {
      // Remove role if set to "none"
      await supabase.from("user_roles").delete().eq("user_id", userData.user_id);
    }

    // Save status
    const { error: statusError } = await supabase
      .from("user_status")
      .upsert({ user_id: userData.user_id, status: userData.status }, { onConflict: "user_id" });

    if (statusError) {
      toast.error("Failed to save status");
      return;
    }

    // Save page access
    for (const page of PAGE_OPTIONS) {
      await supabase
        .from("page_access")
        .upsert(
          { user_id: userData.user_id, page_name: page, has_access: userData.pageAccess[page] },
          { onConflict: "user_id,page_name" }
        );
    }

    toast.success(`Saved settings for ${userData.full_name || userData.email}`);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this user?")) return;
    // Remove roles, status, access (cascade will handle via auth.users if needed)
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("page_access").delete().eq("user_id", userId);
    await supabase.from("user_status").delete().eq("user_id", userId);
    toast.success("User removed from admin panel");
    fetchUsers();
  };

  const handleCreateAdmin = async () => {
    if (!newEmail.trim() || !newPassword || !newName.trim()) {
      toast.error("Please fill all fields");
      return;
    }
    setCreating(true);
    // Note: Creating new users via admin requires an edge function or invite flow
    // For now, we'll just show how to set up roles for existing users
    toast.info("New admin invitations will be implemented via edge function. For now, ask the user to sign up and you can assign their role here.");
    setCreating(false);
    setCreateOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
            </div>
            <p className="ml-12 text-sm text-muted-foreground">
              Manage admin accounts, approvals, and page access
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                Create New Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Admin</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password" type="password" />
                </div>
                <Button onClick={handleCreateAdmin} disabled={creating} className="w-full">
                  {creating ? "Creating..." : "Create Admin"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Users ({users.length})</h2>
        </div>

        <div className="overflow-x-auto rounded-lg border border-primary/30">
          <table className="w-full">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-4 py-3 text-left text-sm font-semibold">Full Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Page Access</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => {
                const isOwner = u.role === "owner";
                const isCurrentUser = u.user_id === user?.id;
                return (
                  <tr key={u.user_id} className={`border-b border-border ${idx % 2 === 0 ? "bg-accent/30" : "bg-card"}`}>
                    <td className="px-4 py-4 text-sm text-foreground">
                      <div className="flex items-center gap-2">
                        {isOwner && <Crown className="h-4 w-4 text-warning" />}
                        {u.full_name || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-4">
                      {isOwner ? (
                        <span className="text-sm italic text-muted-foreground">All Access (Owner)</span>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {PAGE_OPTIONS.map((page) => (
                            <label key={page} className="flex items-center gap-1.5 text-xs">
                              <Checkbox
                                checked={u.pageAccess[page]}
                                onCheckedChange={(checked) =>
                                  handleAccessChange(u.user_id, page, checked as boolean)
                                }
                              />
                              {page}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {isOwner ? (
                        <span className="inline-flex items-center rounded-full border border-success px-3 py-1 text-xs font-medium text-success">
                          Active
                        </span>
                      ) : (
                        <Select value={u.status} onValueChange={(v) => handleStatusChange(u.user_id, v)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-success" />
                                Active
                              </span>
                            </SelectItem>
                            <SelectItem value="inactive">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-destructive" />
                                Inactive
                              </span>
                            </SelectItem>
                            <SelectItem value="pending">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-warning" />
                                Pending
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {isCurrentUser ? (
                        <span className="text-sm text-muted-foreground">(You)</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleSave(u)}>
                            <Save className="mr-1 h-3 w-3" />
                            Save
                          </Button>
                          {!isOwner && (
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(u.user_id)}>
                              <Trash2 className="mr-1 h-3 w-3" />
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
