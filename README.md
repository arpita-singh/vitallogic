# VitalLogic

AI-assisted naturopathic consultations with human expert review.

> 📝 See [`CHANGELOG.md`](./CHANGELOG.md) for release notes.

VitalLogic guides patients through a structured intake, refines the picture with an AI chat, and routes a draft recommendation to a qualified practitioner who reviews, edits, and approves it before the patient receives anything.

## What it does

1. **Intake** — Patient completes a six-step questionnaire (symptoms, timing, lifestyle, safety, goals, contact).
2. **AI chat** — A guided conversation fills in gaps and confirms context.
3. **Draft recommendation** — The system generates a structured prescription draft from the consult.
4. **Expert review** — A practitioner claims the draft from a queue, edits it, and approves, rejects, or escalates.
5. **Delivery** — The patient is notified and can view the approved recommendation.

## Tech stack

- **Framework**: TanStack Start v1 (React 19, file-based routing, server functions)
- **Build**: Vite 7
- **Styling**: Tailwind CSS v4 with semantic design tokens (`src/styles.css`)
- **UI**: shadcn/ui components
- **Backend**: Lovable Cloud (managed Postgres, authentication, edge functions, storage)
- **AI**: Lovable AI Gateway (Gemini / GPT models, no separate API key required)

## Project structure

```
src/
  routes/                          File-based routes
    index.tsx                      Landing page
    origins, philosophy, pillars,  Marketing pages
      journey, integrity.tsx
    consult.tsx                    Intake stepper entry point
    consult.$consultId.tsx         Live AI chat
    consult.$consultId.result.tsx  Approved recommendation view
    login, signup, reset-password,
      account.tsx                  Auth flows
    _authenticated/                Routes requiring sign-in
      _expert/                     Routes requiring the "expert" role
        expert.tsx                 Practitioner queue
        expert.$prescriptionId.tsx Prescription editor
  components/
    consult/                       Patient-facing components
    expert/                        Practitioner-facing components
    ui/                            shadcn primitives
  lib/
    consult-server.ts              Server functions (startConsult, claim, save contact)
    auth.tsx                       Auth context + helpers
  integrations/supabase/           Auto-generated client + types (do not edit)

supabase/
  functions/
    consult-chat/                  AI chat edge function
    generate-prescription/         Draft generator edge function
  migrations/                      Schema history
```

## Key flows

### Anonymous patient
A visitor can complete a consult without signing up. The consult is inserted with `user_id = null`; the contact email captured in step 6 is how the practitioner reaches them.

### Authenticated patient
If the visitor is signed in, the server verifies their token and auto-claims the consult so it appears in their account history. The contact step pre-fills with their account email and profile name.

### Expert review
Users with the `expert` role see the practitioner dashboard at `/expert`. Drafts can be claimed (locking them to one reviewer), edited, and finalized. Every change is recorded in `prescription_audit` for traceability.

## Local development

```bash
bun install
bun run dev
```

The dev server runs on `http://localhost:8080`.

Environment variables (`.env`) are managed automatically by Lovable Cloud — do not edit `.env`, `src/integrations/supabase/client.ts`, or `src/integrations/supabase/types.ts` by hand.

### Useful scripts

```bash
bun run build     # Production build
bun run preview   # Preview the production build locally
bun run lint      # ESLint
```

## Backend

Data, authentication, and serverless functions are provisioned and managed through Lovable Cloud. Row-Level Security policies protect every table; role checks use a dedicated `user_roles` table and a `has_role()` security-definer function (never a column on profiles).

- Schema history lives in `supabase/migrations/`.
- Edge functions live in `supabase/functions/` and deploy automatically.

## Deployment

The app is deployed automatically via Lovable.

- **Production**: https://vitallogic.lovable.app

## Editing

- **In Lovable** (recommended): open the project and describe the change you want.
- **Locally**: clone the repository, run `bun install` and `bun run dev`, and edit with your IDE of choice. Changes pushed back to the connected repository will reflect in Lovable.

## Disclaimer

VitalLogic is a decision-support tool. Recommendations generated and reviewed through this platform are not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider with questions about a medical condition, and seek emergency care for urgent symptoms.
