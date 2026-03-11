import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  requiredPage?: string;
}

const ProtectedRoute = ({ children, requiredRole, requiredPage }: ProtectedRouteProps) => {
  const { user, loading, userRole, userStatus, pageAccess, adminPanelAccess } = useAuth();
  const location = useLocation();

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

  const isOnPendingPage = location.pathname === "/pending-approval";
  const isApproved = userRole && userStatus === "active";
  const isOwner = userRole === "owner";

  if (!isOwner && !isApproved && !isOnPendingPage) {
    return <Navigate to="/pending-approval" replace />;
  }

  if ((isOwner || isApproved) && isOnPendingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  // Role-based check — for admin route, also allow users with admin_panel_access
  if (requiredRole) {
    if (!userRole) return <Navigate to="/dashboard" replace />;
    const hasRole = requiredRole.includes(userRole);
    const hasAdminAccess = requiredRole.includes("owner") && adminPanelAccess;
    if (!hasRole && !hasAdminAccess) return <Navigate to="/dashboard" replace />;
  }

  // Page-access check
  if (requiredPage) {
    if (userRole !== "owner") {
      if (!userRole) return <Navigate to="/dashboard" replace />;
      if (userStatus !== "active") return <Navigate to="/dashboard" replace />;
      const hasAccess = pageAccess?.[requiredPage] ?? false;
      if (!hasAccess) return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
