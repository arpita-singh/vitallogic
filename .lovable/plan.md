

## Fix — `intake_no_length_limits`

### Goal
Add zod-based input validation to all server entry points that accept free-text from the browser, and bound conversation history before it hits the AI.

### Affected files

1. **`src/lib/consult-server.ts`** — `startConsult`, `saveConsultContact`, `getConsult`, `claimConsult`, `unlockEducation`. Replace the placeholder `.inputValidator((data) => data)` with `zod` schemas that enforce length, format, and enum constraints.

2. **`supabase/functions/consult-chat/index.ts`** — validate the request body with zod: bound the messages array length, per-message length, total payload, and role enum.

3. **`supabase/functions/generate-prescription/index.ts`** — truncate `consult.intake` free-text fields and clip the joined message history to a hard character cap before embedding in the AI prompt.

### Schema

```ts
// src/lib/consult-schema.ts (shared, server-only — also re-imported into edge fns by hand-copy since edge fns can't import src/)
import { z } from "zod";

const shortText = z.string().trim().max(500);
const longText  = z.string().trim().max(2000);

export const intakeSchema = z.object({
  symptoms:     z.array(z.string().max(100)).max(20).default([]),
  symptomsNote: longText.optional(),
  duration:     z.enum(["acute", "subacute", "chronic"]).optional(),
  severity:     z.number().int().min(0).max(10).optional(),
  sleepHours:   z.number().min(0).max(24).optional(),
  stress:       z.number().int().min(0).max(5).optional(),
  diet:         shortText.optional(),
  activity:     z.number().int().min(0).max(5).optional(),
  meds:         longText.optional(),
  allergies:    longText.optional(),
  pregnancy:    z.enum(["yes", "no", "na"]).optional(),
  under18:      z.boolean().optional(),
  goals:        z.array(z.string().max(100)).max(20).default([]),
  contactEmail: z.string().trim().toLowerCase().email().max(255).optional(),
  contactName:  shortText.optional(),
});
```

Then per server fn:

```ts
// startConsult
.inputValidator((data: unknown) => z.object({
  intake: intakeSchema,
}).parse(data))

// saveConsultContact
.inputValidator((data: unknown) => z.object({
  consultId:    z.string().uuid(),
  contactEmail: z.string().trim().toLowerCase().email().max(255),
  contactName:  z.string().trim().max(500).optional(),
  anonToken:    z.string().max(128).optional(),
}).parse(data))

// getConsult / claimConsult / unlockEducation — bound consultId/anonToken too
```

### consult-chat (edge function)

```ts
const Body = z.object({
  consultId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().max(4000),
  })).max(50),
});
const parsed = Body.parse(await req.json());
const totalChars = parsed.messages.reduce((n, m) => n + m.content.length, 0);
if (totalChars > 30_000) return new Response("Payload too large", { status: 413 });
```

Decision: **don't** rewrite the function to load history from the DB this pass — that's a larger behavioural change. The length caps already neutralise the storage-abuse and runaway-cost vectors the scanner cares about. I'll add a TODO comment.

### generate-prescription (edge function)

Truncate each intake free-text field and the concatenated message history to fixed caps before building the prompt. ~30k char hard cap.

### Files changed
- `src/lib/consult-server.ts` — zod validators on all 5 server fns.
- `supabase/functions/consult-chat/index.ts` — body validation + length caps.
- `supabase/functions/generate-prescription/index.ts` — truncation pre-prompt.
- Scanner: `mark_as_fixed` for `intake_no_length_limits`.

### Out of scope
- Loading message history from DB instead of trusting client (separate behavioural change).
- `user_roles_self_readable` (separate finding, separate pass).

