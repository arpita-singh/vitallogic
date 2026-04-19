import { useState } from "react";
import { toast } from "sonner";
import { Mail, CheckCircle2 } from "lucide-react";
import { saveConsultContact } from "@/lib/consult-server";

export function ContactCapture({ consultId }: { consultId: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      await saveConsultContact({
        data: {
          consultId,
          contactEmail: email.trim(),
          contactName: name.trim() || undefined,
        },
      });
      setSaved(true);
      toast.success("Contact details saved.");
    } catch (err) {
      console.error(err);
      toast.error("Could not save contact details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border border-gold/40 bg-gold/5 p-5 text-left">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div>
            <p className="text-sm font-medium text-foreground">You're all set.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We'll email <span className="text-foreground">{email}</span> as soon as a
              practitioner has reviewed your recommendation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-6 max-w-sm rounded-2xl border border-gold/40 bg-gold/5 p-5 text-left"
    >
      <div className="flex items-center gap-2 text-gold">
        <Mail className="h-4 w-4" />
        <p className="text-xs uppercase tracking-[0.2em]">How should we reach you?</p>
      </div>
      <p className="mt-2 text-sm text-foreground">
        Leave an email so the practitioner can send your reviewed recommendation.
      </p>
      <div className="mt-4 space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/60"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/60"
        />
      </div>
      <button
        type="submit"
        disabled={saving || !email.trim()}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save contact details"}
      </button>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Used only to deliver your recommendation. No marketing.
      </p>
    </form>
  );
}
