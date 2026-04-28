
# Forgot Password — End-to-End Plan

## What you'll get

1. A **"Forgot password?"** link on the `/login` page.
2. A new **`/forgot-password`** page with a single email field, client-side validation, loading + result states.
3. A backend **edge function** (`password-reset-request`) that:
   - Validates the email format server-side.
   - Looks up the email in the auth users table using the service role key.
   - If the email exists → triggers Supabase's password-recovery email (links to your existing `/reset-password` page).
   - If it does **not** exist → returns a clear "This email is not registered with us" response.
4. The existing **`/reset-password`** page already handles setting the new password — no change needed there.
5. Light rate-limiting (per-IP, in-memory) inside the edge function to discourage abuse.

---

## Important security tradeoff (please read)

You asked us to tell the user when the email is **not** registered. This is called **user enumeration** and the security industry generally advises against it because attackers can use the form to harvest a list of valid accounts on your platform.

The standard secure pattern is to show the same generic message ("If that email is registered, we've sent a link") regardless of whether the email exists.

I'll implement **exactly what you asked for** (explicit "not registered" message) by default, but I'll structure the edge function so flipping to the secure mode later is a one-line change (`REVEAL_EMAIL_EXISTENCE = true | false`). If you'd prefer the safer default now, say so and I'll start with `false`.

---

## User flow

```text
/login
  └─ "Forgot password?" link
        ↓
/forgot-password
  ├─ Enter email → client validates format
  ├─ Submit → calls edge function `password-reset-request`
  │     ├─ Email found     → Supabase sends recovery email   → UI: "Check your inbox"
  │     └─ Email not found → UI: "This email is not registered with us. Sign up?"
  ↓ (user clicks link in email)
/reset-password?type=recovery&...
  └─ Existing page: enter new password → updateUser({ password }) → /account
```

---

## Files to create / change

### New
- `src/routes/forgot-password.tsx` — the form page.
- `supabase/functions/password-reset-request/index.ts` — edge function (public, no JWT).

### Modified
- `src/routes/login.tsx` — add "Forgot password?" link under the password field.
- `supabase/config.toml` — register the new edge function with `verify_jwt = false`.

### Untouched (already correct)
- `src/routes/reset-password.tsx` — handles the recovery link & sets the new password.

---

## Technical details

### 1. `/forgot-password` page (`src/routes/forgot-password.tsx`)
- Single `<input type="email" required>` with HTML5 + a small regex check (`/^\S+@\S+\.\S+$/`).
- States: `idle` → `submitting` → `sent` | `not_registered` | `error`.
- Calls the edge function via `supabase.functions.invoke("password-reset-request", { body: { email } })`.
- Result states render distinct UI:
  - `sent`: green/gold confirmation card with "Check your inbox" + "Back to sign in".
  - `not_registered`: amber warning card with "This email is not registered with us." + a `<Link to="/signup">Create an account</Link>`.
  - `error`: red error card with retry.
- Styling matches existing auth pages (`Section`, `Card`, gold accents, Cormorant Garamond display font).

### 2. Edge function `password-reset-request`
- Public function (`verify_jwt = false`) — must be reachable before login.
- Body: `{ email: string }`. Validates format server-side (zod or simple regex + length cap 255).
- Uses `SUPABASE_SERVICE_ROLE_KEY` to call `supabase.auth.admin.listUsers()` paginated, or (preferred) a direct query against `auth.users` via the admin client to check existence by email.
- If found: calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: "<origin>/reset-password" })` → Supabase sends the recovery email using your project's auth email template.
- If not found: returns `{ status: "not_registered" }` (HTTP 200, not 404, so the client can render the message cleanly).
- Returns `{ status: "sent" }` on success.
- Simple in-memory rate limit: max 5 requests per IP per 10 minutes; returns `{ status: "rate_limited" }` after that.
- CORS headers configured for the app origin.
- Constant `REVEAL_EMAIL_EXISTENCE = true` controls whether `not_registered` is returned distinctly or collapsed into `sent` — flip to `false` for the industry-standard secure mode.

### 3. Login page link
- Add `<Link to="/forgot-password" className="text-sm text-gold hover:underline">Forgot password?</Link>` aligned right under the password field.

### 4. Recovery email
- Uses Supabase's **default** auth email template — works out of the box, no domain setup required. The email sender will be `noreply@mail.app.supabase.io` until/unless you configure a custom email domain.
- If you'd like the recovery email to come from your own domain (e.g. `noreply@vitallogic.com`) with branded styling, that's a separate add-on (Lovable Cloud → Emails setup). I can do that as a follow-up if you want — just say the word.

### 5. `supabase/config.toml`
Add:
```toml
[functions.password-reset-request]
verify_jwt = false
```

---

## What I will NOT do (out of scope)
- Custom-branded recovery email templates / custom email domain (separate request).
- Password strength meter on `/reset-password` (existing page already enforces 8+ chars).
- Captcha / hCaptcha integration (rate limiting is enough for v1; can add later).

---

## Open question before I build

**Confirm or override:** Default behavior is to **explicitly say** "This email is not registered" as you asked. Do you want me to keep that, or switch to the safer "If the email is registered we've sent a link" generic message? (My recommendation: ship as-asked now, and we can flip the flag later in 5 seconds.)

If no answer, I'll proceed exactly as you originally requested (explicit not-registered message).
