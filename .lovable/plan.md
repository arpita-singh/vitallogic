

User clicked both Import buttons on `/expert/catalog` and got "Import failed" toast for both. Let me investigate.

The runtime error mentions `expert.catalog.tsx` not found in `routeTree.gen.ts` — the previous rename left a stale reference. Need to check:
1. Did the routeTree.gen.ts properly regenerate? (Yes, it's auto-generated, but the staleness in error suggests preview hasn't picked up — likely transient HMR)
2. The actual import failure — likely a server function error. Need to check server function logs.

The screenshot shows the catalog UI rendering correctly now (success!), but both imports fail. The page itself works — only the server function `importMarketplaceProducts` fails.

Let me check server logs and the function code to diagnose.
