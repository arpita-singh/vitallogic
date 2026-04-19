import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  XCircle,
  Lock,
  Unlock,
  User as UserIcon,
} from "lucide-react";
import { Section } from "@/components/section";
import { ChatMessage } from "@/components/consult/chat-message";
import { RecommendationEditor, type RxData } from "@/components/expert/recommendation-editor";
import { AuditTrail, type AuditEntry } from "@/components/expert/audit-trail";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Intake } from "@/lib/consult-server";

export const Route = createFileRoute("/_authenticated/_expert/expert/$prescriptionId")({
  head: () => ({
    meta: [{ title: "Review consult — Vital Logic" }],
  }),
  component: ReviewPage,
});

type Prescription = {
  id: string;
  consult_id: string;
  status: "pending_review" | "approved" | "rejected" | "escalated";
  draft: RxData;
  final: RxData | null;
  claimed_by: string | null;
  claimed_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
};

type Consult = {
  id: string;
  user_id: string | null;
  created_at: string;
  intake: Intake;
};

type Message = { id: string; role: "user" | "assistant" | "system"; content: string };

function ReviewPage() {
  const { prescriptionId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rx, setRx] = useState<Prescription | null>(null);
  const [consult, setConsult] = useState<Consult | null>(null);
  const [authorName, setAuthorName] = useState<string>("Anonymous");
  const [messages, setMessages] = useState<Message[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [edit, setEdit] = useState<RxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    const { data: p, error: pErr } = await supabase
      .from("prescriptions")
      .select(
        "id, consult_id, status, draft, final, claimed_by, claimed_at, reviewed_by, reviewed_at, review_notes",
      )
      .eq("id", prescriptionId)
      .maybeSingle();
    if (pErr || !p) {
      toast.error("Could not load this consult.");
      setLoading(false);
      return;
    }
    const presc = p as unknown as Prescription;
    setRx(presc);
    setEdit((presc.final ?? presc.draft) as RxData);
    setNotes(presc.review_notes ?? "");

    const { data: c } = await supabase
      .from("consults")
      .select("id, user_id, created_at, intake")
      .eq("id", presc.consult_id)
      .maybeSingle();
    if (c) {
      setConsult(c as unknown as Consult);
      if (c.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", c.user_id)
          .maybeSingle();
        if (prof?.display_name) setAuthorName(prof.display_name);
      } else {
        setAuthorName("Anonymous");
      }
    }

    const { data: msgs } = await supabase
      .from("consult_messages")
      .select("id, role, content")
      .eq("consult_id", presc.consult_id)
      .order("created_at", { ascending: true });
    setMessages((msgs ?? []) as Message[]);

    const { data: aud } = await supabase
      .from("prescription_audit")
      .select("id, action, created_at, actor_id")
      .eq("prescription_id", prescriptionId)
      .order("created_at", { ascending: false });
    setAudit((aud ?? []) as AuditEntry[]);

    setLoading(false);
  }, [prescriptionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const writeAudit = async (action: string, diff: unknown = null) => {
    if (!user) return;
    await supabase.from("prescription_audit").insert({
      prescription_id: prescriptionId,
      actor_id: user.id,
      action,
      diff: diff as never,
    });
  };

  const handleClaim = async () => {
    if (!user || !rx) return;
    setBusy(true);
    // Conditional update: only if currently unclaimed
    const { data, error } = await supabase
      .from("prescriptions")
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", prescriptionId)
      .is("claimed_by", null)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      toast.error("Another expert just claimed this.");
      await load();
      setBusy(false);
      return;
    }
    await writeAudit("claim");
    toast.success("Claimed for review.");
    await load();
    setBusy(false);
  };

  const handleRelease = async () => {
    if (!user || !rx) return;
    setBusy(true);
    const { error } = await supabase
      .from("prescriptions")
      .update({ claimed_by: null, claimed_at: null })
      .eq("id", prescriptionId)
      .eq("claimed_by", user.id);
    if (error) {
      toast.error("Could not release.");
    } else {
      await writeAudit("release");
      toast.success("Released.");
    }
    await load();
    setBusy(false);
  };

  const handleApprove = async () => {
    if (!user || !rx || !edit) return;
    setBusy(true);
    const { error } = await supabase
      .from("prescriptions")
      .update({
        status: "approved",
        final: edit as never,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      })
      .eq("id", prescriptionId);
    if (error) {
      toast.error("Could not approve.");
      setBusy(false);
      return;
    }
    await supabase.from("consults").update({ status: "approved" }).eq("id", rx.consult_id);
    await writeAudit("approve", { draft: rx.draft, final: edit });
    toast.success("Approved and sent.");
    navigate({ to: "/expert", search: { filter: "pending" } });
  };

  const handleReject = async () => {
    if (!user || !rx) return;
    if (!notes.trim()) {
      toast.error("Please add a note explaining the rejection.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("prescriptions")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes,
      })
      .eq("id", prescriptionId);
    if (error) {
      toast.error("Could not reject.");
      setBusy(false);
      return;
    }
    await supabase.from("consults").update({ status: "rejected" }).eq("id", rx.consult_id);
    await writeAudit("reject", { notes });
    toast.success("Rejected.");
    navigate({ to: "/expert", search: { filter: "pending" } });
  };

  const handleEscalate = async () => {
    if (!user || !rx) return;
    if (!notes.trim()) {
      toast.error("Please add a note explaining the escalation.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("prescriptions")
      .update({
        status: "escalated",
        review_notes: notes,
        claimed_by: null,
        claimed_at: null,
      })
      .eq("id", prescriptionId);
    if (error) {
      toast.error("Could not escalate.");
      setBusy(false);
      return;
    }
    await supabase.from("consults").update({ status: "escalated" }).eq("id", rx.consult_id);
    await writeAudit("escalate", { notes });
    toast.success("Escalated.");
    navigate({ to: "/expert", search: { filter: "escalated" } });
  };

  if (loading) {
    return (
      <Section>
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      </Section>
    );
  }
  if (!rx || !consult || !edit) {
    return (
      <Section>
        <p className="text-center text-muted-foreground">Not found.</p>
      </Section>
    );
  }

  const claimedByMe = rx.claimed_by === user?.id;
  const claimedBySomeone = rx.claimed_by && !claimedByMe;
  const isResolved = rx.status === "approved" || rx.status === "rejected";
  const canEdit = claimedByMe && !isResolved;

  return (
    <Section className="!py-6 md:!py-10">
      <div className="mx-auto max-w-5xl">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/expert"
            search={{ filter: "pending" }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Queue
          </Link>
          <span className="font-mono text-xs text-muted-foreground">
            #{rx.id.slice(0, 8)}
          </span>
        </div>

        {/* Claim banner */}
        {claimedBySomeone && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet/40 bg-violet/10 px-4 py-3 text-sm text-foreground">
            <Lock className="h-4 w-4 text-violet" />
            Claimed by another expert. Read-only.
          </div>
        )}
        {!rx.claimed_by && !isResolved && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-foreground">
            <Unlock className="h-4 w-4 text-gold" />
            Unclaimed — claim to begin editing.
          </div>
        )}
        {isResolved && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            Already {rx.status}. Read-only.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left column: intake + conversation */}
          <div className="space-y-6">
            {/* Intake */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl text-foreground">Intake</h2>
                <span className="text-xs text-muted-foreground">
                  {new Date(consult.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <UserIcon className="h-3 w-3" />
                {authorName}
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <IntakeRow label="Symptoms" value={consult.intake.symptoms?.join(", ")} />
                <IntakeRow label="Notes" value={consult.intake.symptomsNote} />
                <IntakeRow label="Duration" value={consult.intake.duration} />
                <IntakeRow
                  label="Severity"
                  value={consult.intake.severity != null ? `${consult.intake.severity}/10` : undefined}
                />
                <IntakeRow
                  label="Sleep"
                  value={
                    consult.intake.sleepHours != null ? `${consult.intake.sleepHours}h` : undefined
                  }
                />
                <IntakeRow
                  label="Stress"
                  value={consult.intake.stress != null ? `${consult.intake.stress}/5` : undefined}
                />
                <IntakeRow label="Diet" value={consult.intake.diet} />
                <IntakeRow
                  label="Activity"
                  value={
                    consult.intake.activity != null ? `${consult.intake.activity}/5` : undefined
                  }
                />
                <IntakeRow label="Meds" value={consult.intake.meds} />
                <IntakeRow label="Allergies" value={consult.intake.allergies} />
                <IntakeRow
                  label="Pregnancy"
                  value={
                    consult.intake.pregnancy && consult.intake.pregnancy !== "na"
                      ? consult.intake.pregnancy
                      : undefined
                  }
                />
                <IntakeRow label="Under 18" value={consult.intake.under18 ? "yes" : undefined} />
                <IntakeRow label="Goals" value={consult.intake.goals?.join(", ")} />
              </dl>
            </div>

            {/* Conversation */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-display text-xl text-foreground">Conversation</h2>
              <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                {messages.filter((m) => m.role !== "system").length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <ChatMessage key={m.id} role={m.role} content={m.content} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right column: editor */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-display text-xl text-foreground">Draft recommendation</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Edit before approving. Original draft is preserved in audit trail.
              </p>
              <div className="mt-5">
                <RecommendationEditor value={edit} onChange={setEdit} disabled={!canEdit} />
              </div>
            </div>

            {canEdit && (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <label className="block">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Reviewer notes (required for reject/escalate)
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </label>
              </div>
            )}

            <AuditTrail entries={audit} />
          </div>
        </div>

        {/* Sticky action bar */}
        {!isResolved && (
          <div className="sticky bottom-0 mt-8 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-0 md:rounded-2xl md:border md:px-5">
            {!rx.claimed_by ? (
              <button
                onClick={handleClaim}
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                Claim for review
              </button>
            ) : claimedByMe ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleApprove}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={handleEscalate}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-destructive/60 bg-destructive/10 px-5 py-3 text-sm font-medium text-destructive disabled:opacity-50"
                >
                  <ShieldAlert className="h-4 w-4" /> Escalate
                </button>
                <button
                  onClick={handleReject}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
                <button
                  onClick={handleRelease}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <Unlock className="h-4 w-4" /> Release
                </button>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Claimed by another expert.
              </p>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function IntakeRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-24 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
