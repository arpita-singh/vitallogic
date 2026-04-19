
Root cause: the URL is already `/consult/$consultId/result`, but the screen you’re seeing is still the parent consult route’s “ready” CTA, not the actual result route. That happens because `src/routes/consult_.$consultId.tsx` has a child route (`consult_.$consultId.result.tsx`) but does not render an `<Outlet />`. So the child result page never mounts, and the “View prescription” button links to the same route you’re already on, which is why it appears dead. The current auto-redirect in the parent route also risks re-navigating to `/result` repeatedly, which matches the runtime “Maximum update depth exceeded” error.

Implementation plan:
1. Convert `src/routes/consult_.$consultId.tsx` into a true parent/layout route that renders `<Outlet />`.
2. Move the current chat/consult UI from that file into a new child index route, `src/routes/consult_.$consultId.index.tsx`, so:
   - `/consult/$consultId` = consult/chat flow
   - `/consult/$consultId/result` = prescription result view
3. Keep `src/routes/consult_.$consultId.result.tsx` as the dedicated prescription page, so the approved result actually renders when the user lands there.
4. Move the “auto-redirect to result if approved” logic into the new index/chat route only, and guard it so it never fires while already on `/result`.
5. Remove the inert self-link state from the consult screen by ensuring the “View prescription” CTA only appears on the chat/index route, not on the result route URL.
6. Re-check header/account links so they still point to `/consult/$consultId/result`, which will now open the real prescription page instead of the parent CTA screen.

Files to change:
- `src/routes/consult_.$consultId.tsx`
- `src/routes/consult_.$consultId.index.tsx` (new)
- `src/routes/consult_.$consultId.result.tsx`

Technical notes:
- No database changes needed.
- This is primarily a routing architecture bug, not a data bug.
- Fixing the route nesting should also eliminate the current self-navigation loop behind the runtime error.

Expected result:
- Clicking “View prescription” on the consult flow opens the actual prescription page.
- Visiting `/consult/$consultId/result` renders the real result screen, not the placeholder CTA.
- The current loop/self-navigation behavior is removed.
