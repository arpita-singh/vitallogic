import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { claimPendingConsult } from "@/lib/claim-consult";

export type AppRole = "user" | "expert" | "admin";

export type ViewMode = "patient" | "expert";

export const VIEW_MODE_KEY = "vl_view_mode";

export function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "patient";
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY);
    if (v === "expert" || v === "patient") return v;
  } catch {
    // ignore
  }
  return "patient";
}

export function setStoredViewMode(mode: ViewMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

export function getPreferredLandingPath(roles: AppRole[]): string {
  const isExpert = roles.includes("expert") || roles.includes("admin");
  if (isExpert && getStoredViewMode() === "expert") {
    return "/expert?filter=pending";
  }
  return "/account";
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isAuthenticated: boolean;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null; claimedConsultId?: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: Error | null; claimedConsultId?: string | null }>;
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

    // 2) Then read existing session AND validate it server-side. getSession()
    // returns whatever is in localStorage without revalidating; if the server
    // has revoked the session (or the refresh token expired) the client would
    // otherwise stay "logged in" forever and every authed request would 401.
    // getUser() round-trips to the auth server and returns null on a stale
    // token — at which point we wipe local storage to match reality.
    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes?.user) {
          // Session is dead on the server. Clear local storage so the UI
          // correctly reflects "signed out". onAuthStateChange will fire
          // SIGNED_OUT and reset roles/user via the subscription above.
          console.warn("Stale session detected on init; signing out locally", userErr);
          await supabase.auth.signOut({ scope: "local" });
          if (!initialized) {
            initialized = true;
            setLoading(false);
          }
          return;
        }
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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        let claimedConsultId: string | null = null;
        if (!error && data.user) {
          claimedConsultId = await claimPendingConsult(data.user.id);
        }
        return { error, claimedConsultId };
      },
      signUp: async (email, password, displayName) => {
        const redirectUrl = `${window.location.origin}/auth/callback`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { display_name: displayName },
          },
        });
        let claimedConsultId: string | null = null;
        if (!error && data.user) {
          claimedConsultId = await claimPendingConsult(data.user.id);
        }
        return { error, claimedConsultId };
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
