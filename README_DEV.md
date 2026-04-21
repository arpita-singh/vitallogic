  * **Vector Brain Crash:** If the AI stops responding, check if the vector container is looping:
    `docker ps | Select-String "supabase_vector"` (PowerShell)
  * **Database Reset:** To wipe the local DB and start fresh:
    `npx supabase db reset`

-----

## 🤝 5. Contributing

  * **Idempotency is Key:** Always use `.upsert()` with `chunk_id` for database writes to prevent duplicates during crashes.
  * **Vibe Coding:** We maintain a "Sunny Goth" aesthetic—dark themes with gold accents. Please check `tailwind.config.js` before adding new UI components.

-----

### Pro-Tip for Zac:

If you're helping with the **Login Flow**, check `src/routes/__root.tsx`. We use TanStack Start for routing, and the Auth listener needs to be rock solid to ensure "Guest Consults" can be claimed by registered users!

-----
