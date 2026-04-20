

User wants me to run UAT on the marketplace ingestion features (Isha Life AU + Healthy Habitat Market) which are built but they can't easily reach in the UI. They're offering to provide UAT details (likely credentials).

Let me check what's actually surfaced. The catalog route exists at `/expert/catalog` per the file list — and they're currently signed in as an expert (network logs confirm `role: expert`). So the UI *is* surfaced, they may just not know the URL or the buttons aren't where they expect.

Let me look at the catalog route to confirm what's there, and the import function, before proposing the UAT plan.
