import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Activity, TrendingUp, Users, Clock } from "lucide-react";

export type ObservabilitySnapshot = {
  consults7d: number;
  prescriptions7d: number;
  approved7d: number;
  medianReviewHours: number | null;
  oldestPendingHours: number | null;
  pendingCount: number;
  escalatedCount: number;
  unclaimedPending: number;
  daily: { date: string; consults: number; approved: number }[];
  funnel: { label: string; count: number }[];
  activity: ActivityEvent[];
  activeExperts: { expertId: string; reviews: number }[];
};

type ActivityEvent = {
  id: string;
  ts: string;
  kind: "consult" | "rx_created" | "rx_approved" | "role_grant" | "role_revoke";
  detail: string;
};

const DAY = 24 * 60 * 60 * 1000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ObservabilityPanel({
  onSnapshot,
}: {
  onSnapshot?: (snap: ObservabilitySnapshot) => void;
}) {
  const [snap, setSnap] = useState<ObservabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const now = Date.now();
      const since30 = new Date(now - 30 * DAY).toISOString();
      const since14 = new Date(now - 14 * DAY).toISOString();
      const since7 = new Date(now - 7 * DAY).toISOString();

      const [consultsRes, rxRes, purchasesRes, roleLogRes] = await Promise.all([
        supabase
          .from("consults")
          .select("id, created_at, status")
          .gte("created_at", since30)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("prescriptions")
          .select(
            "id, created_at, status, claimed_at, reviewed_at, reviewed_by, claimed_by",
          )
          .gte("created_at", since30)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("user_purchases")
          .select("id, created_at, has_unlocked_education")
          .gte("created_at", since30)
          .limit(1000),
        supabase
          .from("role_audit_log")
          .select("id, action, role, target_user_id, actor_id, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const consults = consultsRes.data ?? [];
      const rxs = rxRes.data ?? [];
      const purchases = purchasesRes.data ?? [];
      const roleLogs = roleLogRes.data ?? [];

      // Last-7d KPIs
      const consults7d = consults.filter((c) => c.created_at >= since7).length;
      const rx7d = rxs.filter((r) => r.created_at >= since7);
      const prescriptions7d = rx7d.length;
      const approved7d = rx7d.filter((r) => r.status === "approved").length;

      // Median review time
      const reviewDurations: number[] = [];
      for (const r of rxs) {
        if (r.claimed_at && r.reviewed_at) {
          const dur =
            new Date(r.reviewed_at).getTime() - new Date(r.claimed_at).getTime();
          if (dur > 0) reviewDurations.push(dur);
        }
      }
      reviewDurations.sort((a, b) => a - b);
      const medianReviewHours =
        reviewDurations.length === 0
          ? null
          : Math.round(
              (reviewDurations[Math.floor(reviewDurations.length / 2)] /
                (60 * 60 * 1000)) *
                10,
            ) / 10;

      // Queue health
      const pendingRx = rxs.filter((r) => r.status === "pending_review");
      const pendingCount = pendingRx.length;
      const unclaimedPending = pendingRx.filter((r) => !r.claimed_by).length;
      const escalatedCount = rxs.filter((r) => r.status === "escalated").length;
      const oldestPending =
        pendingRx.length === 0
          ? null
          : Math.min(...pendingRx.map((r) => new Date(r.created_at).getTime()));
      const oldestPendingHours =
        oldestPending === null
          ? null
          : Math.round(((now - oldestPending) / (60 * 60 * 1000)) * 10) / 10;

      // 14-day daily series
      const days: { date: string; consults: number; approved: number }[] = [];
      const consultsByDay = new Map<string, number>();
      const approvedByDay = new Map<string, number>();
      for (const c of consults) {
        if (c.created_at >= since14) {
          const k = dayKey(new Date(c.created_at));
          consultsByDay.set(k, (consultsByDay.get(k) ?? 0) + 1);
        }
      }
      for (const r of rxs) {
        if (r.status === "approved" && r.reviewed_at && r.reviewed_at >= since14) {
          const k = dayKey(new Date(r.reviewed_at));
          approvedByDay.set(k, (approvedByDay.get(k) ?? 0) + 1);
        }
      }
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now - i * DAY);
        const k = dayKey(d);
        days.push({
          date: k,
          consults: consultsByDay.get(k) ?? 0,
          approved: approvedByDay.get(k) ?? 0,
        });
      }

      // Funnel (last 30d)
      const funnel = [
        { label: "Consults", count: consults.length },
        { label: "Prescriptions", count: rxs.length },
        { label: "Approved", count: rxs.filter((r) => r.status === "approved").length },
        {
          label: "Unlocked / Purchased",
          count: purchases.filter((p) => p.has_unlocked_education).length,
        },
      ];

      // Activity feed (union, sorted)
      const activity: ActivityEvent[] = [];
      for (const c of consults.slice(0, 20)) {
        activity.push({
          id: `c:${c.id}`,
          ts: c.created_at,
          kind: "consult",
          detail: `Consult started · ${c.status}`,
        });
      }
      for (const r of rxs.slice(0, 20)) {
        activity.push({
          id: `rx:${r.id}`,
          ts: r.created_at,
          kind: "rx_created",
          detail: `Prescription drafted`,
        });
        if (r.status === "approved" && r.reviewed_at) {
          activity.push({
            id: `rxa:${r.id}`,
            ts: r.reviewed_at,
            kind: "rx_approved",
            detail: `Approved by ${(r.reviewed_by ?? "?").slice(0, 8)}`,
          });
        }
      }
      for (const l of roleLogs) {
        activity.push({
          id: `r:${l.id}`,
          ts: l.created_at,
          kind: l.action === "grant" ? "role_grant" : "role_revoke",
          detail: `${l.action} ${l.role} on ${l.target_user_id.slice(0, 8)} by ${(l.actor_id ?? "system").slice(0, 8)}`,
        });
      }
      activity.sort((a, b) => (a.ts < b.ts ? 1 : -1));
      const trimmedActivity = activity.slice(0, 20);

      // Active experts (last 7d)
      const expertCounts = new Map<string, number>();
      for (const r of rxs) {
        if (r.reviewed_by && r.reviewed_at && r.reviewed_at >= since7) {
          expertCounts.set(r.reviewed_by, (expertCounts.get(r.reviewed_by) ?? 0) + 1);
        }
      }
      const activeExperts = Array.from(expertCounts.entries())
        .map(([expertId, reviews]) => ({ expertId, reviews }))
        .sort((a, b) => b.reviews - a.reviews);

      const next: ObservabilitySnapshot = {
        consults7d,
        prescriptions7d,
        approved7d,
        medianReviewHours,
        oldestPendingHours,
        pendingCount,
        escalatedCount,
        unclaimedPending,
        daily: days,
        funnel,
        activity: trimmedActivity,
        activeExperts,
      };

      if (cancelled) return;
      setSnap(next);
      setLoading(false);
      onSnapshot?.(next);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !snap) {
    return (
      <div className="rounded-2xl border border-border bg-surface/50 p-6 text-center text-sm text-muted-foreground">
        Loading observability…
      </div>
    );
  }

  const ageColor =
    snap.oldestPendingHours === null
      ? "bg-emerald-500/60"
      : snap.oldestPendingHours < 4
        ? "bg-emerald-500/60"
        : snap.oldestPendingHours < 24
          ? "bg-amber-500/60"
          : "bg-rose-500/60";

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          icon={Activity}
          label="Consults (7d)"
          value={String(snap.consults7d)}
        />
        <Kpi
          icon={TrendingUp}
          label="Rx generated (7d)"
          value={String(snap.prescriptions7d)}
        />
        <Kpi
          icon={TrendingUp}
          label="Rx approved (7d)"
          value={String(snap.approved7d)}
        />
        <Kpi
          icon={Clock}
          label="Median review"
          value={
            snap.medianReviewHours === null
              ? "—"
              : `${snap.medianReviewHours}h`
          }
        />
      </div>

      {/* Queue health */}
      <div className="rounded-2xl border border-border bg-surface/50 p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Queue health
        </h3>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Pending</div>
            <div className="font-display text-2xl text-foreground">
              {snap.pendingCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Unclaimed</div>
            <div className="font-display text-2xl text-foreground">
              {snap.unclaimedPending}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Escalated</div>
            <div className="font-display text-2xl text-foreground">
              {snap.escalatedCount}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">
              Oldest pending age
            </span>
            <span className="text-xs font-medium text-foreground">
              {snap.oldestPendingHours === null
                ? "—"
                : `${snap.oldestPendingHours}h`}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
            <div
              className={cn("h-full transition-all", ageColor)}
              style={{
                width: `${Math.min(
                  100,
                  ((snap.oldestPendingHours ?? 0) / 48) * 100,
                )}%`,
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>0h</span>
            <span>4h</span>
            <span>24h</span>
            <span>48h+</span>
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <Sparkline daily={snap.daily} />

      {/* Funnel */}
      <div className="rounded-2xl border border-border bg-surface/50 p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Conversion funnel (last 30d)
        </h3>
        <div className="mt-3 space-y-2">
          {snap.funnel.map((step, i) => {
            const top = snap.funnel[0]?.count ?? 0;
            const widthPct = top === 0 ? 0 : (step.count / top) * 100;
            const prev = snap.funnel[i - 1]?.count;
            const dropPct =
              prev && prev > 0
                ? Math.round(((prev - step.count) / prev) * 100)
                : null;
            return (
              <div key={step.label}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-foreground">{step.label}</span>
                  <span className="text-muted-foreground">
                    {step.count}
                    {dropPct !== null && dropPct > 0 && (
                      <span className="ml-2 text-rose-500">−{dropPct}%</span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full bg-gold/70"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active experts */}
      <div className="rounded-2xl border border-border bg-surface/50 p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">
          <Users className="mr-1 inline h-3 w-3" />
          Active experts (last 7d)
        </h3>
        {snap.activeExperts.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No reviews completed in the last 7 days.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {snap.activeExperts.map((e) => (
              <li
                key={e.expertId}
                className="flex items-center justify-between"
              >
                <span className="font-mono text-[11px] text-foreground">
                  {e.expertId.slice(0, 8)}…
                </span>
                <span className="text-xs text-muted-foreground">
                  {e.reviews} review{e.reviews === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Activity feed */}
      <div className="rounded-2xl border border-border bg-surface/50">
        <div className="border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Recent activity
        </div>
        {snap.activity.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Nothing yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {snap.activity.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <span className="w-32 shrink-0 text-[11px] text-muted-foreground">
                  {new Date(e.ts).toLocaleString()}
                </span>
                <KindBadge kind={e.kind} />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {e.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/50 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl text-foreground">{value}</div>
    </div>
  );
}

function Sparkline({
  daily,
}: {
  daily: { date: string; consults: number; approved: number }[];
}) {
  const max = Math.max(1, ...daily.map((d) => Math.max(d.consults, d.approved)));
  const w = 560;
  const h = 100;
  const pad = 4;
  const barW = (w - pad * 2) / daily.length;

  return (
    <div className="rounded-2xl border border-border bg-surface/50 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">
          14-day activity
        </h3>
        <div className="flex gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-foreground/60" />
            Consults
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-gold/70" />
            Approved
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-3 h-24 w-full"
        preserveAspectRatio="none"
      >
        {daily.map((d, i) => {
          const x = pad + i * barW;
          const cH = (d.consults / max) * (h - 16);
          const aH = (d.approved / max) * (h - 16);
          return (
            <g key={d.date}>
              <title>{`${d.date} · ${d.consults} consults · ${d.approved} approved`}</title>
              <rect
                x={x + 1}
                y={h - cH - 12}
                width={Math.max(1, barW / 2 - 1)}
                height={cH}
                className="fill-foreground/60"
              />
              <rect
                x={x + barW / 2}
                y={h - aH - 12}
                width={Math.max(1, barW / 2 - 1)}
                height={aH}
                className="fill-gold/70"
              />
            </g>
          );
        })}
        <text
          x={pad}
          y={h - 2}
          className="fill-muted-foreground"
          fontSize="8"
        >
          {daily[0]?.date}
        </text>
        <text
          x={w - pad}
          y={h - 2}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize="8"
        >
          {daily[daily.length - 1]?.date}
        </text>
      </svg>
    </div>
  );
}

function KindBadge({ kind }: { kind: ActivityEvent["kind"] }) {
  const meta: Record<ActivityEvent["kind"], { label: string; cls: string }> = {
    consult: { label: "consult", cls: "border-foreground/30 text-foreground/80" },
    rx_created: { label: "rx", cls: "border-foreground/30 text-foreground/80" },
    rx_approved: {
      label: "approved",
      cls: "border-emerald-500/40 text-emerald-500",
    },
    role_grant: { label: "grant", cls: "border-gold/40 text-gold" },
    role_revoke: { label: "revoke", cls: "border-rose-500/40 text-rose-500" },
  };
  const m = meta[kind];
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}
