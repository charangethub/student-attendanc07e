import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  userStatus: string | null;
  pageAccess: Record<string, boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  userRole: null,
  userStatus: null,
  pageAccess: {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [pageAccess, setPageAccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setUserRole(null);
        setUserStatus(null);
        setPageAccess({});
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (roleError) {
      console.error("Failed to fetch user role:", roleError.message);
    }
    setUserRole(roleData?.role ?? null);

    const { data: statusData, error: statusError } = await supabase
      .from("user_status")
      .select("status")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (statusError) {
      console.error("Failed to fetch user status:", statusError.message);
    }
    setUserStatus(statusData?.status ?? "pending");

    const { data: accessData, error: accessError } = await supabase
      .from("page_access")
      .select("page_name, has_access")
      .eq("user_id", userId);

    if (accessError) {
      console.error("Failed to fetch page access:", accessError.message);
    } else if (accessData) {
      const accessMap: Record<string, boolean> = {};
      accessData.forEach(item => {
        accessMap[item.page_name] = item.has_access;
      });
      setPageAccess(accessMap);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, userStatus, pageAccess, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
