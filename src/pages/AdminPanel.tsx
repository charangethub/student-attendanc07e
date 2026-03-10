import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Crown, Plus, Save, Trash2, UserCheck, Settings } from "lucide-react";

import { PAGE_OPTIONS } from "@/config/pageOptions";

const ROLE_OPTIONS = ["admin", "teacher"];

interface UserData {
  user_id: string;
  full_name: string;
  email: string;
  role: string | null;
  status: string;
  pageAccess: Record<string, boolean>;
}

const SETTINGS_KEYS = [
  { key: "google_apps_script_url", label: "Google Apps Script URL" },
  { key: "google_sheet_csv_url", label: "Google Sheet CSV URL" },
  { key: "web_app_url", label: "Web App URL" },
  { key: "linked_app_url_1", label: "Linked App 1 URL" },
  { key: "linked_app_url_1_label", label: "Linked App 1 Label" },
  { key: "linked_app_url_2", label: "Linked App 2 URL" },
  { key: "linked_app_url_2_label", label: "Linked App 2 Label" },
  { key: "auto_approve_google", label: "Auto-approve Google Sign-ins (true/false)" },
];

const AdminPanel = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // System settings
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchSettings();
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

  const fetchSettings = async () => {
    setSettingsLoading(true);
    const { data } = await supabase.from("system_settings").select("key, value");
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => {
      map[r.key] = r.value;
    });
    setSettings(map);
    setSettingsLoading(false);
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

    // Batch save page access
    const accessRows = PAGE_OPTIONS.map((page) => ({
      user_id: userData.user_id,
      page_name: page,
      has_access: userData.pageAccess[page] ?? false,
    }));
    const { error: accessError } = await supabase
      .from("page_access")
      .upsert(accessRows, { onConflict: "user_id,page_name" });
    if (accessError) {
      toast.error("Failed to save page access: " + accessError.message);
      return;
    }

    toast.success(`Saved settings for ${userData.full_name || userData.email}`);
  };

  const handleDelete = async (userId: string) => {
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
    try {
      const { data, error } = await supabase.functions.invoke("create-admin-user", {
        body: { email: newEmail.trim(), password: newPassword, full_name: newName.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Admin created successfully!");
      setCreateOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      fetchUsers();
    } catch (err: any) {
      toast.error("Failed to create admin: " + (err.message || "Unknown error"));
    }
    setCreating(false);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
      const { error } = await supabase.from("system_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error("Failed to save settings: " + err.message);
    }
    setSavingSettings(false);
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

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">
              <UserCheck className="mr-1 h-4 w-4" />
              Users
            </TabsTrigger>
            {userRole === "owner" && (
              <TabsTrigger value="settings">
                <Settings className="mr-1 h-4 w-4" />
                System Settings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users">
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
                    <th className="px-4 py-3 text-left text-sm font-semibold">Role</th>
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
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {u.email || "—"}
                        </td>
                        <td className="px-4 py-4">
                          {isOwner ? (
                            <span className="inline-flex items-center rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary">
                              Owner
                            </span>
                          ) : (
                            <Select value={u.role || "none"} onValueChange={(v) => handleRoleChange(u.user_id, v)}>
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Role</SelectItem>
                                {ROLE_OPTIONS.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
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
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive">
                                      <Trash2 className="mr-1 h-3 w-3" />
                                      Delete
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove User?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will remove <strong>{u.full_name || u.email}</strong> from the system.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(u.user_id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Yes, Remove
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
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
          </TabsContent>

          {userRole === "owner" && (
            <TabsContent value="settings">
              <div className="max-w-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">System Settings</h2>
                  <Button onClick={handleSaveSettings} disabled={savingSettings}>
                    <Save className="mr-1 h-4 w-4" />
                    {savingSettings ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
                {settingsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {SETTINGS_KEYS.map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-sm">{label}</Label>
                        <Input
                          value={settings[key] ?? ""}
                          onChange={(e) =>
                            setSettings((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder={`Enter ${label.toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
