import { Link } from "@tanstack/react-router";
import { ShieldAlert, Clock, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type QueueItem = {
  id: string;
  status: "pending_review" | "approved" | "rejected" | "escalated";
  created_at: string;
  claimed_by: string | null;
  consult_id: string;
  symptoms: string[];
  red_flags: string[];
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<string, string> = {
  pending_review: "border-gold/40 bg-gold/10 text-gold",
  escalated: "border-destructive/40 bg-destructive/10 text-destructive",
  approved: "border-violet/40 bg-violet/10 text-violet",
  rejected: "border-border bg-muted/30 text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending",
  escalated: "Escalated",
  approved: "Approved",
  rejected: "Rejected",
};

export function QueueCard({ item, isMine }: { item: QueueItem; isMine: boolean }) {
  const escalated = item.status === "escalated";
  return (
    <Link
      to="/expert/$prescriptionId"
      params={{ prescriptionId: item.id }}
      className={cn(
        "block rounded-2xl border bg-surface p-4 transition-colors hover:border-gold/50",
        escalated ? "border-destructive/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider",
              STATUS_STYLES[item.status] ?? STATUS_STYLES.pending_review,
            )}
          >
            {STATUS_LABELS[item.status]}
          </span>
          {item.red_flags.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
              <ShieldAlert className="h-3 w-3" />
              {item.red_flags.length} flag{item.red_flags.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo(item.created_at)}
        </span>
      </div>

      {item.symptoms.length > 0 && (
        <p className="mt-3 line-clamp-2 text-sm text-foreground">
          {item.symptoms.slice(0, 5).join(" · ")}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-mono">#{item.id.slice(0, 8)}</span>
        {item.claimed_by ? (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              isMine ? "text-gold" : "text-muted-foreground",
            )}
          >
            <UserCheck className="h-3 w-3" />
            {isMine ? "You claimed" : "Claimed"}
          </span>
        ) : (
          <span className="text-muted-foreground/60">Unclaimed</span>
        )}
      </div>
    </Link>
  );
}
