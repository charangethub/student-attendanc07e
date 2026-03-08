import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import DashboardAnalytics from "@/components/DashboardAnalytics";
import MonthlyAnalytics from "@/components/MonthlyAnalytics";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, Users, ClipboardCheck, AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const navItems = [
  {
    title: "Mark Attendance",
    description: "Take daily attendance for students by classroom",
    icon: ClipboardCheck,
    path: "/attendance",
    color: "bg-success/10 text-success",
  },
  {
    title: "Absentee Report",
    description: "View daily absentees & send WhatsApp messages to parents",
    icon: AlertTriangle,
    path: "/absentees",
    color: "bg-destructive/10 text-destructive",
  },
  {
    title: "Attendance Records",
    description: "Monthly & yearly attendance records with export",
    icon: BarChart3,
    path: "/records",
    color: "bg-primary/10 text-primary",
  },
];

const Dashboard = () => {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-sheet");
      if (error) throw error;
      toast.success(`Synced ${data?.synced ?? 0} students from Google Sheet`);
    } catch (err: any) {
      toast.error("Sync failed: " + (err.message || "Unknown error"));
    }
    setSyncing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Vedantu Attendance</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(userRole === "owner" || userRole === "admin") && (
              <>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  Sync Sheet
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                  <Shield className="mr-1 h-4 w-4" />
                  Admin
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Your role: <span className="font-semibold text-primary">{userRole ?? "pending approval"}</span>
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="group rounded-xl border border-border bg-card p-6 text-left transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ${item.color}`}>
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </button>
          ))}
        </div>

        {/* Analytics Section */}
        <div className="mt-8">
          <DashboardAnalytics />
        </div>

        {/* Monthly Statistics */}
        <div className="mt-8 border-t border-border pt-8">
          <MonthlyAnalytics />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
