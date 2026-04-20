import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Section } from "@/components/section";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_expert/expert_/admin/roles")({
  head: () => ({
    meta: [{ title: "Admin · Roles — Vital Logic" }],
  }),
  component: AdminRolesPage,
});

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type RoleRow = {
  user_id: string;
  role: AppRole;
};

type UserWithRoles = ProfileRow & { roles: AppRole[] };

const MANAGEABLE_ROLES: AppRole[] = ["expert", "admin"];

function AdminRolesPage() {
  const { user, hasRole } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const isAdmin = hasRole("admin");

  const load = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name")
        .order("display_name", { ascending: true })
        .limit(500),
      supabase.from("user_roles").select("user_id, role").limit(2000),
    ]);

    if (profilesRes.error) {
      console.error(profilesRes.error);
      toast.error("Failed to load profiles");
      setUsers([]);
      setLoading(false);
      return;
    }
    if (rolesRes.error) {
      console.error(rolesRes.error);
      toast.error("Failed to load roles");
    }

    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of (rolesRes.data ?? []) as RoleRow[]) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    }

    const merged: UserWithRoles[] = (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      display_name: p.display_name,
      roles: rolesByUser.get(p.id) ?? [],
    }));
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.display_name?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q),
    );
  }, [users, search]);

  const toggleRole = async (target: UserWithRoles, role: AppRole) => {
    const has = target.roles.includes(role);
    const isSelf = target.id === user?.id;

    // Lock-out guard: cannot remove your own admin role.
    if (has && role === "admin" && isSelf) {
      toast.error("You cannot remove your own admin role.");
      return;
    }

    const key = `${target.id}:${role}`;
    setPendingKey(key);
    try {
      if (has) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", target.id)
          .eq("role", role);
        if (error) throw error;
        toast.success(`Removed ${role} from ${target.display_name ?? "user"}`);
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: target.id, role });
        if (error) throw error;
        toast.success(`Granted ${role} to ${target.display_name ?? "user"}`);
      }
      // Optimistic local update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === target.id
            ? {
                ...u,
                roles: has ? u.roles.filter((r) => r !== role) : [...u.roles, role],
              }
            : u,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      toast.error(msg);
    } finally {
      setPendingKey(null);
    }
  };

  if (!isAdmin) {
    return (
      <Section className="py-16">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="font-display text-3xl text-foreground">Admins only</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Role management is restricted to administrators.
          </p>
          <Link
            to="/expert"
            search={{ filter: "pending" }}
            className="mt-6 inline-block rounded-full border border-gold/40 px-4 py-1.5 text-xs uppercase tracking-wider text-gold hover:bg-gold/10"
          >
            Back to queue
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <Section className="py-12 md:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-4xl text-foreground md:text-5xl">
            Admin · <span className="text-gradient-gold">Roles</span>
          </h1>
          <Link
            to="/expert"
            search={{ filter: "pending" }}
            className="rounded-full border border-gold/40 px-3 py-1 text-[11px] uppercase tracking-wider text-gold hover:bg-gold/10"
          >
            Back to queue
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Grant or revoke <span className="text-foreground">expert</span> and{" "}
          <span className="text-foreground">admin</span> access. Every user implicitly has the{" "}
          <span className="text-foreground">user</span> role.
        </p>

        <div className="mt-6">
          <Input
            placeholder="Search by display name or user id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface/50">
          <div className="grid grid-cols-12 gap-3 border-b border-border bg-surface/80 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-5">User</div>
            <div className="col-span-3">Current roles</div>
            <div className="col-span-4 text-right">Actions</div>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading users…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No users match.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <li
                    key={u.id}
                    className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm"
                  >
                    <div className="col-span-5">
                      <div className="font-medium text-foreground">
                        {u.display_name ?? <span className="italic text-muted-foreground">No name</span>}
                        {isSelf ? (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-gold">
                            you
                          </span>
                        ) : null}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {u.id.slice(0, 8)}…{u.id.slice(-4)}
                      </div>
                    </div>
                    <div className="col-span-3 flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          user
                        </Badge>
                      ) : (
                        u.roles.map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase tracking-wider",
                              r === "admin" && "border-gold/60 text-gold",
                              r === "expert" && "border-foreground/40 text-foreground",
                            )}
                          >
                            {r}
                          </Badge>
                        ))
                      )}
                    </div>
                    <div className="col-span-4 flex flex-wrap justify-end gap-2">
                      {MANAGEABLE_ROLES.map((role) => {
                        const has = u.roles.includes(role);
                        const key = `${u.id}:${role}`;
                        const pending = pendingKey === key;
                        const lockedSelfAdmin = has && role === "admin" && isSelf;
                        return (
                          <Button
                            key={role}
                            size="sm"
                            variant={has ? "default" : "outline"}
                            disabled={pending || lockedSelfAdmin}
                            onClick={() => void toggleRole(u, role)}
                            className="h-7 rounded-full px-3 text-[11px] uppercase tracking-wider"
                            title={
                              lockedSelfAdmin
                                ? "You cannot remove your own admin role"
                                : has
                                  ? `Revoke ${role}`
                                  : `Grant ${role}`
                            }
                          >
                            {pending ? "…" : has ? `Revoke ${role}` : `Grant ${role}`}
                          </Button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
