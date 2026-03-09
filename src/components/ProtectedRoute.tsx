import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  requiredPage?: string;
}

const ProtectedRoute = ({ children, requiredRole, requiredPage }: ProtectedRouteProps) => {
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

  if (requiredRole) {
    if (!userRole) return <Navigate to="/dashboard" replace />;
    if (!requiredRole.includes(userRole)) return <Navigate to="/dashboard" replace />;
  }

  if (requiredPage) {
    // Owners can always access
    if (userRole !== "owner") {
      // No role or not approved => block
      if (!userRole) return <Navigate to="/dashboard" replace />;
      if (userStatus !== "active") return <Navigate to="/dashboard" replace />;
      const hasAccess = pageAccess?.[requiredPage] ?? false;
      if (!hasAccess) return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
