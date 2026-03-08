import { useAuth } from "@/contexts/AuthContext";
import DashboardAnalytics from "@/components/DashboardAnalytics";
import MonthlyAnalytics from "@/components/MonthlyAnalytics";

const Dashboard = () => {
  const { userRole } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Your role: <span className="font-semibold text-primary">{userRole ?? "pending approval"}</span>
        </p>
      </div>

      {/* Analytics Section */}
      <DashboardAnalytics />

      {/* Monthly Statistics */}
      <div className="mt-8 border-t border-border pt-8">
        <MonthlyAnalytics />
      </div>
    </div>
  );
};

export default Dashboard;
