import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, Users } from "lucide-react";

const Dashboard = () => {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
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
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="mr-1 h-4 w-4" />
                Admin Panel
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground">Welcome to the Dashboard</h2>
          <p className="mt-2 text-muted-foreground">
            Attendance features will be built in the next phase.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your role: <span className="font-semibold text-primary">{userRole ?? "pending approval"}</span>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
