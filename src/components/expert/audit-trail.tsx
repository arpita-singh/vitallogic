import { useState } from "react";
import { ChevronDown, ChevronUp, FileClock } from "lucide-react";

export type AuditEntry = {
  id: string;
  action: string;
  created_at: string;
  actor_id: string | null;
  actor_name?: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  claim: "Claimed for review",
  release: "Released claim",
  approve: "Approved",
  reject: "Rejected",
  escalate: "Escalated",
};

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
      >
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <FileClock className="h-4 w-4" />
          Audit trail ({entries.length})
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-foreground">{ACTION_LABELS[e.action] ?? e.action}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {e.actor_name ?? (e.actor_id ? e.actor_id.slice(0, 8) : "system")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
