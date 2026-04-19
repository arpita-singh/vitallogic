import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Mail } from "lucide-react";
import type { Intake } from "@/lib/consult-server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SYMPTOMS = [
  "Headache",
  "Fatigue",
  "Sleep",
  "Stress",
  "Digestion",
  "Pain",
  "Mood",
  "Skin",
  "Hormonal",
  "Other",
];

const DIETS = ["omnivore", "vegetarian", "vegan", "keto", "other"];

const GOALS = [
  "Symptom relief",
  "Prevention",
  "Energy",
  "Sleep",
  "Education",
  "Long-term wellness",
];

export function IntakeStepper({
  onComplete,
  submitting,
  initialContactEmail,
  initialContactName,
  signedIn,
}: {
  onComplete: (intake: Intake) => void;
  submitting?: boolean;
  initialContactEmail?: string;
  initialContactName?: string;
  signedIn?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<Intake>({
    symptoms: [],
    symptomsNote: "",
    duration: undefined,
    severity: 5,
    sleepHours: 7,
    stress: 3,
    diet: "omnivore",
    activity: 3,
    meds: "",
    allergies: "",
    pregnancy: "na",
    under18: false,
    goals: [],
    contactEmail: initialContactEmail ?? "",
    contactName: initialContactName ?? "",
  });

  // When auth/profile resolves after mount, fill in any contact fields
  // the user hasn't already edited themselves.
  useEffect(() => {
    setIntake((s) => ({
      ...s,
      contactEmail: s.contactEmail ? s.contactEmail : (initialContactEmail ?? ""),
      contactName: s.contactName ? s.contactName : (initialContactName ?? ""),
    }));
  }, [initialContactEmail, initialContactName]);

  const total = 6;
  const progress = ((step + 1) / total) * 100;

  const toggleArr = (key: "symptoms" | "goals", v: string) => {
    setIntake((s) => {
      const arr = s[key];
      return { ...s, [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });
  };

  const emailValid = EMAIL_RE.test((intake.contactEmail ?? "").trim());

  const canNext = (() => {
    if (step === 0) return intake.symptoms.length > 0 || (intake.symptomsNote ?? "").length > 5;
    if (step === 1) return !!intake.duration;
    if (step === 4) return intake.goals.length > 0;
    if (step === 5) return emailValid;
    return true;
  })();

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <span>
            Step {step + 1} of {total}
          </span>
          <span className="text-gold">{stepLabel(step)}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-violet to-gold transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step body */}
      <div className="rounded-3xl border border-border bg-surface p-6 md:p-8">
        {step === 0 && (
          <div>
            <h3 className="font-display text-2xl text-foreground md:text-3xl">
              What's going on?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick anything that fits. There's a place for your own words below.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {SYMPTOMS.map((s) => (
                <Chip
                  key={s}
                  active={intake.symptoms.includes(s)}
                  onClick={() => toggleArr("symptoms", s)}
                >
                  {s}
                </Chip>
              ))}
            </div>
            <textarea
              value={intake.symptomsNote}
              onChange={(e) => setIntake((s) => ({ ...s, symptomsNote: e.target.value }))}
              placeholder="In your own words…"
              rows={3}
              className="mt-5 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
            />
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="font-display text-2xl text-foreground md:text-3xl">How long?</h3>
            <div className="mt-5 grid gap-3">
              {(
                [
                  ["acute", "Acute", "Less than 2 weeks"],
                  ["subacute", "Subacute", "2 to 8 weeks"],
                  ["chronic", "Chronic", "Longer than 8 weeks"],
                ] as const
              ).map(([v, label, desc]) => (
                <button
                  key={v}
                  onClick={() => setIntake((s) => ({ ...s, duration: v }))}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                    intake.duration === v
                      ? "border-gold bg-gold/10"
                      : "border-border bg-background hover:border-gold/40",
                  )}
                >
                  <div>
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <span
                    className={cn(
                      "h-3 w-3 rounded-full border",
                      intake.duration === v ? "border-gold bg-gold" : "border-border",
                    )}
                  />
                </button>
              ))}
            </div>
            <Slider
              label="Severity right now"
              suffix={`${intake.severity}/10`}
              min={1}
              max={10}
              value={intake.severity ?? 5}
              onChange={(v) => setIntake((s) => ({ ...s, severity: v }))}
              className="mt-6"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="font-display text-2xl text-foreground md:text-3xl">A bit about you</h3>
            <Slider
              label="Sleep"
              suffix={`${intake.sleepHours}h / night`}
              min={3}
              max={12}
              value={intake.sleepHours ?? 7}
              onChange={(v) => setIntake((s) => ({ ...s, sleepHours: v }))}
            />
            <Slider
              label="Stress"
              suffix={`${intake.stress}/5`}
              min={1}
              max={5}
              value={intake.stress ?? 3}
              onChange={(v) => setIntake((s) => ({ ...s, stress: v }))}
            />
            <div>
              <label className="text-sm uppercase tracking-wider text-muted-foreground">
                Diet
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DIETS.map((d) => (
                  <Chip
                    key={d}
                    active={intake.diet === d}
                    onClick={() => setIntake((s) => ({ ...s, diet: d }))}
                  >
                    {d}
                  </Chip>
                ))}
              </div>
            </div>
            <Slider
              label="Activity"
              suffix={`${intake.activity}/5`}
              min={1}
              max={5}
              value={intake.activity ?? 3}
              onChange={(v) => setIntake((s) => ({ ...s, activity: v }))}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h3 className="font-display text-2xl text-foreground md:text-3xl">Safety check</h3>
            <div>
              <label className="text-sm uppercase tracking-wider text-muted-foreground">
                Current medications
              </label>
              <textarea
                value={intake.meds}
                onChange={(e) => setIntake((s) => ({ ...s, meds: e.target.value }))}
                rows={2}
                placeholder="Anything prescription or over-the-counter."
                className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm uppercase tracking-wider text-muted-foreground">
                Allergies
              </label>
              <textarea
                value={intake.allergies}
                onChange={(e) => setIntake((s) => ({ ...s, allergies: e.target.value }))}
                rows={2}
                placeholder="Foods, herbs, medications…"
                className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm uppercase tracking-wider text-muted-foreground">
                Pregnancy
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["yes", "no", "na"] as const).map((v) => (
                  <Chip
                    key={v}
                    active={intake.pregnancy === v}
                    onClick={() => setIntake((s) => ({ ...s, pregnancy: v }))}
                  >
                    {v === "na" ? "Not applicable" : v}
                  </Chip>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background p-3">
              <input
                type="checkbox"
                checked={intake.under18 ?? false}
                onChange={(e) => setIntake((s) => ({ ...s, under18: e.target.checked }))}
                className="h-4 w-4 accent-gold"
              />
              <span className="text-sm text-foreground">I'm under 18</span>
            </label>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="font-display text-2xl text-foreground md:text-3xl">
              What would feel like a win?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">Pick any that resonate.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <Chip
                  key={g}
                  active={intake.goals.includes(g)}
                  onClick={() => toggleArr("goals", g)}
                >
                  {g}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 className="font-display text-2xl text-foreground md:text-3xl">
              How should we reach you?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {signedIn
                ? "We've prefilled your account details. Edit if you'd prefer a different inbox for this consult."
                : "Your reviewing practitioner will email you when your recommendation is ready. We'll never share this."}
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="contact-name"
                  className="text-sm uppercase tracking-wider text-muted-foreground"
                >
                  Your name <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={intake.contactName ?? ""}
                  onChange={(e) =>
                    setIntake((s) => ({ ...s, contactName: e.target.value }))
                  }
                  placeholder="First name or how we should address you"
                  maxLength={100}
                  className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="contact-email"
                  className="text-sm uppercase tracking-wider text-muted-foreground"
                >
                  Email <span className="text-gold">*</span>
                </label>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="contact-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={intake.contactEmail ?? ""}
                    onChange={(e) =>
                      setIntake((s) => ({ ...s, contactEmail: e.target.value }))
                    }
                    placeholder="you@example.com"
                    maxLength={255}
                    className={cn(
                      "w-full rounded-xl border bg-background p-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none",
                      emailValid || !(intake.contactEmail ?? "").length
                        ? "border-border focus:border-gold"
                        : "border-destructive/60 focus:border-destructive",
                    )}
                  />
                </div>
                {!emailValid && (intake.contactEmail ?? "").length > 0 && (
                  <p className="mt-1.5 text-xs text-destructive">
                    Please enter a valid email address.
                  </p>
                )}
              </div>
              <p className="rounded-xl border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                Used only to deliver your reviewed recommendation. No marketing, ever.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
          className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {step < total - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => onComplete(intake)}
            disabled={!canNext || submitting}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {submitting ? "Starting…" : "Begin consult"}
          </button>
        )}
      </div>
    </div>
  );
}

function stepLabel(s: number) {
  return ["Symptoms", "Timing", "Lifestyle", "Safety", "Goals"][s];
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm capitalize transition-all",
        active
          ? "border-gold bg-gold/15 text-foreground"
          : "border-border bg-background text-muted-foreground hover:border-gold/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  suffix,
  min,
  max,
  value,
  onChange,
  className,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-sm uppercase tracking-wider text-muted-foreground">{label}</label>
        <span className="text-sm text-gold">{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gold"
      />
    </div>
  );
}
