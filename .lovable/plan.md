

User reports `/expert/catalog` shows nothing. Their screenshots show:
1. `/catalog` → 404 (expected — wrong path)
2. `/expert/catalog` → renders the **Expert queue** page, NOT a catalog page. So the route is matching the wrong file.

Looking at the file list:
- `src/routes/_authenticated/_expert/expert.tsx` → `/expert` (queue)
- `src/routes/_authenticated/_expert/expert.catalog.tsx` → should be `/expert/catalog`

In TanStack Router flat-dot naming, `expert.catalog.tsx` makes `/expert/catalog` a **child of `expert.tsx`'s layout**. But `expert.tsx` is a leaf component (renders the queue directly, no `<Outlet />`), so visiting `/expert/catalog` likely either 404s or falls back. The screenshot shows the queue rendering at `/expert/catalog` — meaning the router is matching `expert.tsx` and ignoring the `.catalog` segment, OR the catalog route file isn't being picked up by the generated route tree.

I need to verify in default mode:
1. Read `src/routes/_authenticated/_expert/expert.tsx` — does it render queue directly or have `<Outlet />`?
2. Read `src/routeTree.gen.ts` — is `/expert/catalog` registered?
3. Read `src/routes/_authenticated/_expert/expert.catalog.tsx` — confirm it exports a Route.

Most likely fix: `expert.tsx` is a leaf, not a layout. Two clean options:
- **Option A** (recommended): Rename `expert.tsx` → `expert.index.tsx` (queue at `/expert`) and add `expert.tsx` as a pure layout with `<Outlet />`. Then `/expert/catalog` works as a sibling child.
- **Option B**: Rename `expert.catalog.tsx` → `expert_.catalog.tsx` (the underscore opt-out from layout nesting, matching the pattern used by `expert_.$prescriptionId.tsx` and `expert_.consult.$consultId.tsx` already in the codebase). This is the **simpler, more consistent fix** — those sibling files already use this exact pattern, so the catalog route was just named inconsistently.

Option B is the right call: one file rename, matches existing convention, no new layout file needed.

## Plan: Fix `/expert/catalog` not rendering

### Root cause
The catalog route file is named `expert.catalog.tsx` which makes TanStack Router try to nest it under `expert.tsx`'s layout. But `expert.tsx` is the queue page (a leaf, no `<Outlet />`), so the catalog never renders — the queue page shows instead. The other expert sub-routes already use the `expert_.` (underscore) pattern to opt out of this nesting:
- `expert_.$prescriptionId.tsx` ✓
- `expert_.consult.$consultId.tsx` ✓
- `expert.catalog.tsx` ✗ (inconsistent — missing the underscore)

### Fix (one file rename)
- Rename `src/routes/_authenticated/_expert/expert.catalog.tsx` → `src/routes/_authenticated/_expert/expert_.catalog.tsx`
- Update the `createFileRoute` path string inside the file from `/_authenticated/_expert/expert/catalog` to `/_authenticated/_expert/expert_/catalog` (TanStack regenerates `routeTree.gen.ts` automatically — no manual edit there)
- Verify the "Catalog review" link in `expert.tsx` still uses `to="/expert/catalog"` (unchanged — the URL stays the same, only the file naming changes)

### Verification once shipped
1. Visit `/expert/catalog` → catalog page renders with **Import from Healthy Habitat Market** and **Import from Isha Life AU** buttons + source filter chip
2. Click "Catalog review" pill on `/expert` → navigates correctly
3. Other expert routes (`/expert/<prescriptionId>`, `/expert/consult/<consultId>`) still work

### Files touched
- Rename: `src/routes/_authenticated/_expert/expert.catalog.tsx` → `expert_.catalog.tsx` (with the one-line path string update inside)

