import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  pageName?: string;
}

const ProtectedRoute = ({ children, requiredRole, pageName }: ProtectedRouteProps) => {
  const { user, loading, userRole, userStatus, pageAccess } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (userStatus !== "active") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <div className="mb-4 rounded-full bg-warning/20 p-4">
          <svg className="h-8 w-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold">Account Pending Approval</h1>
        <p className="mb-6 text-muted-foreground max-w-md">
          Your account is currently waiting for administrator approval. You will be able to access the dashboard once your account is approved.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  if (requiredRole && (!userRole || !requiredRole.includes(userRole))) {
    return <Navigate to="/dashboard" replace />;
  }

  if (pageName && userRole !== "owner") {
    const allowed = pageAccess[pageName] === true;

    if (!allowed) {
      // Find the first available page if this one is denied
      const availablePage = Object.entries(pageAccess).find(([_, hasAccess]) => hasAccess)?.[0];

      if (!availablePage) {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
            <h1 className="mb-2 text-2xl font-bold">No Access Granted</h1>
            <p className="mb-6 text-muted-foreground max-w-md">
              You haven't been granted access to any pages yet. Please contact an administrator.
            </p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign Out
            </button>
          </div>
        );
      }

      // Navigate to the first available page
      const routes: Record<string, string> = {
        Dashboard: "/dashboard",
        "Mark Attendance": "/attendance",
        "Absentee Report": "/absentees",
        "Attendance Records": "/records",
      };

      return <Navigate to={routes[availablePage] || "/dashboard"} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
