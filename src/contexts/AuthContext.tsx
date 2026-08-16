import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "startup" | "client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let revision = 0;

    const applySession = async (nextSession: Session | null) => {
      const currentRevision = ++revision;
      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);

      if (!nextUser) {
        setRoles([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const nextRoles = await fetchRoles(nextUser.id);
      if (!active || currentRevision !== revision) return;
      setRoles(nextRoles);
      setLoading(false);
    };

    // Register the listener before bootstrapping. Work is deferred because
    // Supabase advises against awaiting API calls inside the auth callback.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setTimeout(() => void applySession(nextSession), 0);
    });

    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (active) void applySession(initialSession);
    });

    return () => {
      active = false;
      revision += 1;
      sub.subscription.unsubscribe();
    };
  }, []);

  const fetchRoles = async (uid: string): Promise<AppRole[]> => {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (error) {
      console.error("Unable to load user roles", error.message);
      return [];
    }
    return (data?.map((r) => r.role) as AppRole[]) ?? [];
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        isAdmin: roles.includes("admin"),
        isCreator: roles.includes("startup"),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
