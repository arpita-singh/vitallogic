

User wants observability added to the audit dashboard at `/expert/admin/audit`. Currently the page shows static-ish read-only checks but no live signal on what's actually happening in the system. Observability for this product means: are users completing consults, are experts reviewing prescriptions on time, are edge functions failing, are there errors in logs.

Available signals I can pull without new infra:
1. **Database time-series** (already accessible via supabase client as admin):
   - Consults created per day (last 14d)
   - Prescriptions created vs approved per day
   - Median time-to-review (claimed_at → reviewed_at)
   - Pending queue depth + age of oldest pending
   - Active experts (distinct reviewed_by in last 7d)
2. **Funnel**: consult started → prescription generated → expert claimed → approved → user viewed (proxy via `user_purchases`)
3. **Edge function health**: I can't query Supabase analytics from the browser client — but I can surface the *names* of edge functions and link to backend logs. Live log fetching requires a server function (admin-gated) that calls the Supabase analytics API. Skip live logs for v1; instead surface the metrics already in the DB.
4. **Recent activity feed**: last 20 events across consults, prescriptions, role changes — gives a "pulse" view.

## Plan

### Add Observability section to `/expert/admin/audit`

Inserted between the existing "Role distribution" panel and "Checks by track" section. All read-only, all from existing tables, admin-gated by the existing route guard.

**1. KPI tiles (last 7 days)** — 4-up grid:
- Consults started
- Prescriptions generated
- Approved prescriptions
- Median review time (claimed → reviewed, in hours)

**2. Queue health panel**:
- Pending count (already computed) + age of oldest pending in hours
- Escalated count (already computed)
- Unclaimed pending (already computed)
- Coloured bar: green <4h, amber 4–24h, red >24h for oldest pending age

**3. 14-day sparkline (ASCII/SVG)**:
- Daily consult creation count, simple inline SVG bar chart
- Daily approved-prescription count overlaid (or second row)
- No charting library — hand-rolled SVG to keep bundle lean

**4. Funnel (last 30 days)**:
- Consults → Prescriptions → Approved → Purchased (has_unlocked_education)
- Show count + drop-off % at each step

**5. Recent activity feed (last 20)**:
- Union of: consult created, prescription created, prescription approved, role grant/revoke
- Timestamp, action, actor (truncated id), target
- Sourced from `consults`, `prescriptions`, `role_audit_log`

**6. Active experts (last 7d)**:
- Distinct `reviewed_by` from prescriptions reviewed in last 7d, with count of reviews each
- Surfaces load distribution and inactive experts

### Implementation notes
- All queries run client-side via the existing `supabase` import (admin RLS on relevant tables already permits this for admins/experts).
- Metrics computed in JS from raw rows (small data volumes — `<1000` rows fits the default Supabase limit comfortably for an early-stage product).
- New `Observability` panel added inline in `expert_.admin.audit.tsx`; refactor the page to extract the section into a sibling component if it grows past ~150 lines.
- Markdown export updated to include the KPIs + funnel numbers so offline review captures the snapshot.
- No new tables, no migration, no new dependencies.

### Files touched
- Edit: `src/routes/_authenticated/_expert/expert_.admin.audit.tsx` (add observability section + extend export)

### Verification
1. As admin → `/expert/admin/audit` shows new Observability section above the checks
2. KPI tiles render with last-7d numbers (zero-state handled if no data)
3. Sparkline renders 14 bars; hovering shows tooltip with date + count
4. Funnel shows drop-off percentages
5. Recent activity feed lists 20 most recent events across the three sources, sorted by time desc
6. Markdown export includes the new metrics
7. As non-admin expert → page still shows "Admins only" guard

