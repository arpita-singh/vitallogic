import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "user" | "expert" | "admin";

export interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isAuthenticated: boolean;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error || !data) return [];
  return data.map((r) => r.role as AppRole);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let initialized = false;

    // 1) Subscribe FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer the supabase call to avoid deadlock
        setTimeout(() => {
          fetchRoles(newSession.user.id).then((r) => {
            setRoles(r);
            if (!initialized) {
              initialized = true;
              setLoading(false);
            }
          });
        }, 0);
      } else {
        setRoles([]);
        if (!initialized) {
          initialized = true;
          setLoading(false);
        }
      }
    });

    // 2) Then read existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        fetchRoles(existing.user.id).then((r) => {
          setRoles(r);
          if (!initialized) {
            initialized = true;
            setLoading(false);
          }
        });
      } else {
        if (!initialized) {
          initialized = true;
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      roles,
      isAuthenticated: !!user,
      loading,
      hasRole: (role) => roles.includes(role),
      hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
      },
      signUp: async (email, password, displayName) => {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { display_name: displayName },
          },
        });
        return { error };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [user, session, roles, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
