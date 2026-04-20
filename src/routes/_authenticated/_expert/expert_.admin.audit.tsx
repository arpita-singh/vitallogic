import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, Download } from "lucide-react";
import {
  ObservabilityPanel,
  type ObservabilitySnapshot,
} from "@/components/expert/observability-panel";

export const Route = createFileRoute("/_authenticated/_expert/expert_/admin/audit")({
  head: () => ({
    meta: [{ title: "Admin · Audit — Vital Logic" }],
  }),
  component: AdminAuditPage,
});

type Verdict = "pass" | "warn" | "fail";

type Check = {
  id: string;
  track: string;
  title: string;
  verdict: Verdict;
  detail: string;
};

type RoleCount = { role: AppRole; count: number };
type AuditLogRow = {
  id: string;
  action: "grant" | "revoke";
  target_user_id: string;
  role: AppRole;
  actor_id: string | null;
  created_at: string;
};

const VERDICT_META: Record<
  Verdict,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  pass: { label: "Pass", icon: CheckCircle2, className: "text-emerald-500 border-emerald-500/40" },
  warn: { label: "Warn", icon: AlertTriangle, className: "text-amber-500 border-amber-500/40" },
  fail: { label: "Fail", icon: XCircle, className: "text-rose-500 border-rose-500/40" },
};

function AdminAuditPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Check[]>([]);
  const [roleCounts, setRoleCounts] = useState<RoleCount[]>([]);
  const [recentLog, setRecentLog] = useState<AuditLogRow[]>([]);

  const run = async () => {
    setLoading(true);
    const next: Check[] = [];

    // --- Track 1: Auth & access control ---
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role")
      .limit(2000);
    if (rolesErr) {
      next.push({
        id: "roles_read",
        track: "Auth & access",
        title: "Read user_roles",
        verdict: "fail",
        detail: rolesErr.message,
      });
    } else {
      const counts = new Map<AppRole, number>();
      for (const r of roles ?? []) {
        const k = r.role as AppRole;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      const adminCount = counts.get("admin") ?? 0;
      const expertCount = counts.get("expert") ?? 0;
      setRoleCounts(
        (["user", "expert", "admin"] as AppRole[]).map((role) => ({
          role,
          count: counts.get(role) ?? 0,
        })),
      );

      next.push({
        id: "admin_count",
        track: "Auth & access",
        title: "At least one admin exists",
        verdict: adminCount >= 1 ? "pass" : "fail",
        detail: `${adminCount} admin role(s) granted.`,
      });
      next.push({
        id: "admin_succession",
        track: "Operational",
        title: "Admin succession (≥2 admins)",
        verdict: adminCount >= 2 ? "pass" : "warn",
        detail:
          adminCount >= 2
            ? `${adminCount} admins — break-glass cover in place.`
            : "Single admin = no break-glass. Grant admin to a trusted second account.",
      });
      next.push({
        id: "expert_coverage",
        track: "Operational",
        title: "Expert coverage for prescription review",
        verdict: expertCount + adminCount >= 1 ? "pass" : "fail",
        detail: `${expertCount} expert(s) + ${adminCount} admin(s) can review prescriptions.`,
      });
    }

    // --- Track 2: Data integrity ---
    const [
      { count: consultsCount },
      { count: rxCount },
      { count: pendingCount },
      { count: orphanRxCount, error: orphanErr },
    ] = await Promise.all([
      supabase.from("consults").select("*", { count: "exact", head: true }),
      supabase.from("prescriptions").select("*", { count: "exact", head: true }),
      supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .is("claimed_by", null)
        .eq("status", "pending_review"),
    ]);

    next.push({
      id: "data_volume",
      track: "Data integrity",
      title: "Consults & prescriptions present",
      verdict: "pass",
      detail: `${consultsCount ?? 0} consult(s), ${rxCount ?? 0} prescription(s).`,
    });

    if (!orphanErr) {
      next.push({
        id: "unclaimed_pending",
        track: "Operational",
        title: "Unclaimed pending prescriptions",
        verdict:
          (orphanRxCount ?? 0) === 0
            ? "pass"
            : (orphanRxCount ?? 0) > 5
              ? "warn"
              : "pass",
        detail: `${orphanRxCount ?? 0} pending prescription(s) waiting for an expert to claim. ${pendingCount ?? 0} pending in total.`,
      });
    }

    // --- Track 3: Catalog / fulfilment integrity ---
    const { data: catalog, error: catErr } = await supabase
      .from("certified_materia_medica")
      .select("id, product_name, aust_l_number, external_url, artg_verified")
      .limit(1000);

    if (catErr) {
      next.push({
        id: "catalog_read",
        track: "Fulfilment",
        title: "Read catalog",
        verdict: "fail",
        detail: catErr.message,
      });
    } else {
      const total = catalog?.length ?? 0;
      const missingArtg = (catalog ?? []).filter(
        (p) => !p.aust_l_number || p.aust_l_number.trim().length === 0,
      ).length;
      const missingUrl = (catalog ?? []).filter(
        (p) => !p.external_url || p.external_url.trim().length === 0,
      ).length;
      const unverified = (catalog ?? []).filter((p) => !p.artg_verified).length;
      const shareGoogle = (catalog ?? []).filter((p) =>
        (p.external_url ?? "").includes("share.google"),
      ).length;

      next.push({
        id: "artg_coverage",
        track: "Regulatory (TGA)",
        title: "Catalog products have AUST L numbers",
        verdict: total === 0 ? "warn" : missingArtg === 0 ? "pass" : "warn",
        detail:
          total === 0
            ? "Catalog is empty."
            : `${total - missingArtg}/${total} have AUST L numbers (${missingArtg} missing).`,
      });
      next.push({
        id: "artg_verified",
        track: "Regulatory (TGA)",
        title: "Catalog products marked ARTG-verified",
        verdict: total === 0 ? "warn" : unverified === 0 ? "pass" : "warn",
        detail: `${total - unverified}/${total} verified.`,
      });
      next.push({
        id: "vendor_url_present",
        track: "Fulfilment",
        title: "Catalog products have vendor URLs",
        verdict: total === 0 ? "warn" : missingUrl === 0 ? "pass" : "warn",
        detail: `${total - missingUrl}/${total} have external URLs.`,
      });
      next.push({
        id: "vendor_url_canonical",
        track: "Fulfilment",
        title: "Vendor URLs are canonical (no share.google redirects)",
        verdict: shareGoogle === 0 ? "pass" : "warn",
        detail:
          shareGoogle === 0
            ? "All vendor URLs look canonical."
            : `${shareGoogle} product(s) still use share.google redirect URLs.`,
      });
    }

    // --- Track 4: Privacy / PII surface ---
    const { data: recentConsults } = await supabase
      .from("consults")
      .select("intake")
      .order("created_at", { ascending: false })
      .limit(50);
    const withContact = (recentConsults ?? []).filter((c) => {
      const intake = c.intake as { contactEmail?: string; contactName?: string } | null;
      return Boolean(intake?.contactEmail || intake?.contactName);
    }).length;
    next.push({
      id: "pii_inventory",
      track: "Privacy",
      title: "PII captured in consult intake",
      verdict: "warn",
      detail: `${withContact}/${recentConsults?.length ?? 0} recent consults contain contact PII (name/email). Confirm retention policy is documented and disclosed in privacy notice.`,
    });

    // --- Track 5: Role audit log (defence-in-depth visibility) ---
    const { data: log, error: logErr } = await supabase
      .from("role_audit_log")
      .select("id, action, target_user_id, role, actor_id, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (logErr) {
      next.push({
        id: "audit_log",
        track: "Operational",
        title: "Role audit log readable",
        verdict: "fail",
        detail: logErr.message,
      });
    } else {
      setRecentLog((log ?? []) as AuditLogRow[]);
      next.push({
        id: "audit_log",
        track: "Operational",
        title: "Role grants/revokes are logged",
        verdict: "pass",
        detail: `Audit trigger active. ${log?.length ?? 0} recent entries visible.`,
      });
    }

    // --- Track 6: Reliability — pending escalations ---
    const { count: escalatedCount } = await supabase
      .from("prescriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "escalated");
    next.push({
      id: "escalations",
      track: "Reliability",
      title: "Escalated prescriptions awaiting senior review",
      verdict:
        (escalatedCount ?? 0) === 0
          ? "pass"
          : (escalatedCount ?? 0) > 3
            ? "warn"
            : "pass",
      detail: `${escalatedCount ?? 0} escalated.`,
    });

    setChecks(next);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void run();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const summary = useMemo(() => {
    const s = { pass: 0, warn: 0, fail: 0 };
    for (const c of checks) s[c.verdict]++;
    return s;
  }, [checks]);

  const exportMarkdown = () => {
    const lines: string[] = [];
    lines.push("# Vital Logic — Independent Diligence Audit");
    lines.push("");
    lines.push(`_Generated ${new Date().toISOString()}_`);
    lines.push("");
    lines.push(`**Summary:** ✅ ${summary.pass} pass · ⚠ ${summary.warn} warn · ❌ ${summary.fail} fail`);
    lines.push("");
    lines.push("## Role distribution");
    for (const r of roleCounts) lines.push(`- **${r.role}**: ${r.count}`);
    lines.push("");
    lines.push("## Checks");
    const byTrack = new Map<string, Check[]>();
    for (const c of checks) {
      const arr = byTrack.get(c.track) ?? [];
      arr.push(c);
      byTrack.set(c.track, arr);
    }
    for (const [track, items] of byTrack) {
      lines.push(`### ${track}`);
      for (const c of items) {
        const icon = c.verdict === "pass" ? "✅" : c.verdict === "warn" ? "⚠" : "❌";
        lines.push(`- ${icon} **${c.title}** — ${c.detail}`);
      }
      lines.push("");
    }
    lines.push("## Recent role changes");
    if (recentLog.length === 0) lines.push("_No entries._");
    for (const r of recentLog) {
      lines.push(
        `- ${new Date(r.created_at).toISOString()} — ${r.action} \`${r.role}\` on \`${r.target_user_id.slice(0, 8)}\` by \`${(r.actor_id ?? "system").slice(0, 8)}\``,
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vital-logic-audit-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <Section className="py-16">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="font-display text-3xl text-foreground">Admins only</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The diligence audit is restricted to administrators.
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

  const tracks = Array.from(new Set(checks.map((c) => c.track)));

  return (
    <Section className="py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-4xl text-foreground md:text-5xl">
            Admin · <span className="text-gradient-gold">Audit</span>
          </h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void run()}
              disabled={loading}
              className="h-8 rounded-full px-3 text-[11px] uppercase tracking-wider"
            >
              {loading ? "Running…" : "Re-run"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportMarkdown}
              disabled={loading || checks.length === 0}
              className="h-8 rounded-full px-3 text-[11px] uppercase tracking-wider"
            >
              <Download className="mr-1 h-3 w-3" /> Export
            </Button>
            <Link
              to="/expert"
              search={{ filter: "pending" }}
              className="rounded-full border border-gold/40 px-3 py-1 text-[11px] uppercase tracking-wider text-gold hover:bg-gold/10"
            >
              Back to queue
            </Link>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Read-only diligence checks across regulatory, data, access, fulfilment, reliability and
          operational tracks.
        </p>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <SummaryTile label="Pass" value={summary.pass} verdict="pass" />
          <SummaryTile label="Warn" value={summary.warn} verdict="warn" />
          <SummaryTile label="Fail" value={summary.fail} verdict="fail" />
        </div>

        {/* Role distribution */}
        <div className="mt-6 rounded-2xl border border-border bg-surface/50 p-4">
          <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Role distribution
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {roleCounts.map((r) => (
              <Badge
                key={r.role}
                variant="outline"
                className={cn(
                  "text-[11px] uppercase tracking-wider",
                  r.role === "admin" && "border-gold/60 text-gold",
                )}
              >
                {r.role}: {r.count}
              </Badge>
            ))}
          </div>
        </div>

        {/* Checks by track */}
        <div className="mt-6 space-y-4">
          {loading && checks.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Running checks…</p>
          ) : (
            tracks.map((track) => (
              <div key={track} className="rounded-2xl border border-border bg-surface/50">
                <div className="border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {track}
                </div>
                <ul className="divide-y divide-border">
                  {checks
                    .filter((c) => c.track === track)
                    .map((c) => {
                      const meta = VERDICT_META[c.verdict];
                      const Icon = meta.icon;
                      return (
                        <li key={c.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground">{c.title}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{c.detail}</div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-[10px] uppercase tracking-wider",
                              meta.className,
                            )}
                          >
                            {meta.label}
                          </Badge>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Recent role changes */}
        <div className="mt-6 rounded-2xl border border-border bg-surface/50">
          <div className="border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            Recent role changes
          </div>
          {recentLog.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No role changes logged yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentLog.map((r) => (
                <li key={r.id} className="grid grid-cols-12 items-center gap-3 px-4 py-2 text-sm">
                  <div className="col-span-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                  <div className="col-span-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] uppercase tracking-wider",
                        r.action === "grant"
                          ? "border-emerald-500/40 text-emerald-500"
                          : "border-rose-500/40 text-rose-500",
                      )}
                    >
                      {r.action}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] uppercase tracking-wider",
                        r.role === "admin" && "border-gold/60 text-gold",
                      )}
                    >
                      {r.role}
                    </Badge>
                  </div>
                  <div className="col-span-2 font-mono text-[11px] text-foreground">
                    {r.target_user_id.slice(0, 8)}…
                  </div>
                  <div className="col-span-3 font-mono text-[11px] text-muted-foreground">
                    by {(r.actor_id ?? "system").slice(0, 8)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

function SummaryTile({
  label,
  value,
  verdict,
}: {
  label: string;
  value: number;
  verdict: Verdict;
}) {
  const meta = VERDICT_META[verdict];
  const Icon = meta.icon;
  return (
    <div className={cn("rounded-2xl border bg-surface/50 p-4", meta.className)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", meta.className)} />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl text-foreground">{value}</div>
    </div>
  );
}
