# Supabase — canonical source & public-repo notes

## Canonical source
- `migrations/` is canonical. Apply in order with Supabase CLI / dashboard.
- `00_*.sql`–`04_*.sql`, `schema.sql`, and `all_in_one_setup.sql` are helpers for
  pasting into the SQL Editor for demos. They mirror `migrations/` — do not
  diverge them.
- Local CLI state (`supabase/.temp/`, `supabase/.branches/`) is gitignored.

## Security model (public-repo safe)
- RLS is restrictive: no `anon` access, no `USING (true)` for `authenticated`.
  Users only see rows they own or are assigned to (therapist ↔ client scoping).
  `service_role` bypasses RLS by default and is never committed.
- Storage buckets (`program-videos`, `chat-attachments`) are **private**
  (`public = false`) with authenticated-only SELECT/INSERT/UPDATE/DELETE.
- `patients.temporary_password` is a short-lived bootstrap secret, readable only
  by the owning therapist via RLS, and nulled on first login via
  `POST /api/auth/clear-temp-credentials`. Production should replace it with
  Supabase invite / reset-password links.

## Before making the repo public
1. Confirm no keys in history: `git log -p -- .env* supabase/.temp supabase/config.toml`
2. Rotate any exposed anon/service_role keys in Supabase dashboard.
3. Re-apply the SQL on a fresh project to confirm the restrictive policies load cleanly.
