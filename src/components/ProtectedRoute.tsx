import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  requiredPage?: string;
}

const ProtectedRoute = ({ children, requiredRole, requiredPage }: ProtectedRouteProps) => {
  const { user, loading, userRole, userStatus, pageAccess } = useAuth();
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

  // Owners always approved
  const isOwner = userRole === "owner";

  // If user is NOT approved and NOT owner, redirect to pending page (unless already there)
  if (!isOwner && !isApproved && !isOnPendingPage) {
    return <Navigate to="/pending-approval" replace />;
  }

  // If user IS approved/owner but on pending page, redirect to dashboard
  if ((isOwner || isApproved) && isOnPendingPage) {
    return <Navigate to="/dashboard" replace />;
  }

  // Role-based check
  if (requiredRole) {
    if (!userRole) return <Navigate to="/dashboard" replace />;
    if (!requiredRole.includes(userRole)) return <Navigate to="/dashboard" replace />;
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
