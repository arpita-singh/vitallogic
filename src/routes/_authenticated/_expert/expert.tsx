import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Section } from "@/components/section";
import { QueueCard, type QueueItem } from "@/components/expert/queue-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const FILTERS = ["pending", "drafts", "escalated", "mine", "all"] as const;
type Filter = (typeof FILTERS)[number];

const searchSchema = z.object({
  filter: fallback(z.enum(FILTERS), "pending").default("pending"),
});

export const Route = createFileRoute("/_authenticated/_expert/expert")({
  head: () => ({
    meta: [{ title: "Expert dashboard — Vital Logic" }],
  }),
  validateSearch: zodValidator(searchSchema),
  component: ExpertDashboard,
});

type RxRow = {
  id: string;
  status: QueueItem["status"];
  created_at: string;
  claimed_by: string | null;
  consult_id: string;
  draft: { red_flags?: string[] } | null;
  consults: {
    intake: { symptoms?: string[]; contactName?: string; contactEmail?: string } | null;
  } | null;
};

type DraftRow = {
  id: string;
  created_at: string;
  intake: { symptoms?: string[]; contactName?: string; contactEmail?: string } | null;
};

const TAB_LABELS: Record<Filter, string> = {
  pending: "Pending",
  drafts: "Drafts",
  escalated: "Escalated",
  mine: "Mine",
  all: "All",
};

function ExpertDashboard() {
  const { filter } = Route.useSearch();
  const { user } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (filter === "drafts") {
      // Show in-progress consults (no prescription yet) so experts see who's mid-flow.
      const { data, error } = await supabase
        .from("consults")
        .select("id, created_at, intake")
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error(error);
        setItems([]);
      } else {
        const mapped: QueueItem[] = (data as unknown as DraftRow[]).map((c) => ({
          id: c.id, // use consult id as item id since no prescription yet
          status: "pending_review",
          created_at: c.created_at,
          claimed_by: null,
          consult_id: c.id,
          symptoms: c.intake?.symptoms ?? [],
          red_flags: [],
          contactName: c.intake?.contactName ?? null,
          contactEmail: c.intake?.contactEmail ?? null,
          isDraft: true,
        }));
        setItems(mapped);
      }
      setLoading(false);
      return;
    }

    let q = supabase
      .from("prescriptions")
      .select(
        "id, status, created_at, claimed_by, consult_id, draft, consults!inner(intake)",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter === "pending") q = q.eq("status", "pending_review");
    else if (filter === "escalated") q = q.eq("status", "escalated");
    else if (filter === "mine" && user) q = q.eq("claimed_by", user.id);

    const { data, error } = await q;
    if (error) {
      console.error(error);
      setItems([]);
    } else {
      const mapped: QueueItem[] = (data as unknown as RxRow[]).map((r) => ({
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        claimed_by: r.claimed_by,
        consult_id: r.consult_id,
        symptoms: r.consults?.intake?.symptoms ?? [],
        red_flags: r.draft?.red_flags ?? [],
        contactName: r.consults?.intake?.contactName ?? null,
        contactEmail: r.consults?.intake?.contactEmail ?? null,
      }));
      setItems(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user?.id]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`expert-queue`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prescriptions" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consults" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user?.id]);

  return (
    <Section className="py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-4xl text-foreground md:text-5xl">
            Expert <span className="text-gradient-gold">queue</span>
          </h1>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <Link
              key={f}
              from={Route.fullPath}
              search={{ filter: f }}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-xs uppercase tracking-wider transition-colors",
                filter === f
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border text-muted-foreground hover:border-gold/40 hover:text-foreground",
              )}
            >
              {TAB_LABELS[f]}
            </Link>
          ))}
        </div>

        {/* List */}
        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading queue…</p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
              <p className="font-display text-2xl text-foreground">
                {filter === "drafts" ? "No drafts in progress." : "Queue is clear."}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {filter === "drafts"
                  ? "Patients mid-consult appear here with their contact details."
                  : "Take a moment. We'll let you know when something needs you."}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <QueueCard key={item.id} item={item} isMine={item.claimed_by === user?.id} />
            ))
          )}
        </div>
      </div>
    </Section>
  );
}
