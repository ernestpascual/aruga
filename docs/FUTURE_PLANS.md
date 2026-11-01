# Aruga — Future Plans: Encryption Roadmap

> **Status:** Planning document — no code shipped yet. Tracks approved hardening (`docs/PRIVACY_HARDENING_LATEST.md:1`) and two encryption tracks proposed for Q1–Q2 2027. Current platform encryption is TLS in-transit + Supabase AES-256 at-rest (managed keys); no app-level or E2E ciphertext yet.

---

## Table of Contents

1. [Where We Are Today](#1-where-we-are-today)
2. [Track A — Column-Level Encryption (pgsodium / Vault)](#2-track-a--column-level-encryption-pgsodium--vault)
3. [Track B — Client-Side End-to-End Encryption (WebCrypto Envelope)](#3-track-b--client-side-end-to-end-encryption-webcrypto-envelope)
4. [Comparison & Recommendation](#4-comparison--recommendation)
5. [Phased Rollout](#5-phased-rollout)
6. [Key Rotation & Recovery](#6-key-rotation--recovery)
7. [Compliance & Audit Implications](#7-compliance--audit-implications)
8. [Open Questions](#8-open-questions)

---

## 1. Where We Are Today

### 1.1 Current encryption (platform-managed)

| Layer | Mechanism | Owner |
|---|---|---|
| In transit | TLS 1.2+ (Supabase + Vercel edge) | Platform |
| At rest (DB) | AES-256 volume encryption, managed keys | Supabase/AWS |
| At rest (Storage) | SSE-S3 for `program-videos`, `chat-attachments`, `activity-assets` | Supabase Storage |
| Backups / WAL | Encrypted snapshots, same managed key | Platform |
| App fields | **Plaintext** — `soap_notes.*`, `submission_reviews.*`, `messages.body`, `patients.email`, `program_steps.instructions` readable by `service_role` + DB superuser + anyone with snapshot access | — |

Completed hardening (Nov 2026) closed access-control gaps but left data readable to infrastructure layer:

- **C1** Cross-tenant writes → `auth.uid()` + `therapist_owns_patient()` at every insert (`src/app/api/activities/generate/route.ts:42`, `src/app/api/therapist/soap-notes/route.ts:140`).
- **C2** 7-day bearer URLs → random `nanoid(12)` prefix + per-view `15m`/`60m` signed URLs (`src/app/api/client/submissions/upload/route.ts:105,158`).
- **C3** RLS `qual=true` → dropped 42 permissive policies, restored `supabase/01_schema.sql:322` restrictive set; audited via `scripts/verify-rls.sql:1`.
- **H1–H4** Demo-gate, `403→404` oracle normalization, `maskEmail()`, `sharp` EXIF strip.
- SQL is consolidated in `supabase/RUN_ONCE_PRIVACY_FIX.sql:1` + `supabase/RUN_ONCE_PRIVACY_FIX_C3_DROP_OPEN_POLICIES.sql:1`.

### 1.2 Why neither track shipped yet

- **Column-level** needs Vault + `pgsodium` provisioning, index redesign, and a live-data migration — not safe to rush before audit close.
- **E2E** needs key-distribution UX, recovery flows, and product sign-off (clinicians must understand "lost key = lost history" vs escrow trade-off).
- Both are additive on top of current RLS/API guards; they **do not replace** them.

### 1.3 Goals for both tracks

1. Survive a stolen snapshot / leaked `service_role` key / compromised replica with ciphertext-only exposure.
2. Keep therapist/client reads fast (< 50 ms p95) and search usable.
3. Preserve auditability and HIPAA BAA eligibility.
4. Allow key rotation without re-issuing every row.

---

## 2. Track A — Column-Level Encryption (pgsodium + Vault)

Protects PHI inside Postgres from infrastructure-level readers (snapshot theft, replica, insider with DB superuser, leaked `service_role`).

### 2.1 What to encrypt (proposed)

| Table | Columns | Reason | Keep plaintext? |
|---|---|---|---|
| `soap_notes` | `subjective`, `objective`, `assessment`, `plan`, `client_summary` | Clinical narrative, highest ePHI density | `patient_id`, `therapist_id`, `created_at` stay plaintext for RLS/index |
| `submission_reviews` | `overall_feedback`, `client_summary` | Published review content | `submission_id`, `status` plaintext |
| `step_reviews` | `therapist_note` | Per-step feedback | FKs plaintext |
| `messages` | `body`, `attachment_storage_path` (optional) | Thread content | `patient_id`, `sender_id` plaintext |
| `patients` | `email` (deterministic) | PII lookup | `id`, `therapist_id`, `client_user_id` plaintext |
| `profiles` | `phone`, `emergency_phone`, `date_of_birth` | PII | `id`, `role` plaintext |

> **Do not encrypt:** foreign keys, status enums, timestamps, IDs — RLS and joins must still be plannable.

### 2.2 Choice of primitive: `pgsodium` over `pgcrypto`

| Criterion | `pgcrypto` (`pgp_sym_encrypt` / `crypt`) | `pgsodium` (libsodium + Vault) |
|---|---|---|
| Key storage | Key literal in SQL or env var — leaks in logs, `pg_stat_statements` | Key ID in `pgsodium.key` via Supabase Vault — never in query text |
| Algorithm | AES-256-CBC or PGP, caller-chosen | XChaCha20-Poly1305 (AEAD) with nonce handled internally |
| Rotation | Manual re-encrypt, key string hunt | `pgsodium.create_key()` + versioned key ID, re-encrypt by ID |
| Supabase support | Available but discouraged for new PHI | **Recommended** by Supabase for Vault-backed TCE |
| Audit | Weak | Key usage auditable via `vault.*` |

**Decision:** `pgsodium` + Supabase Vault. `pgcrypto` remains only for hashing (`crypt()` for non-PHI if needed) and `gen_random_uuid()`.

### 2.3 Architecture

```
Client / API (service_role) ──► Postgres
                                   │
                    ┌──────────────▼──────────────┐
                    │  Encrypted columns          │
                    │  BYTEA = pgsodium.crypto_  │
                    │         aead.det_encrypt(   │
                    │           plaintext::bytea,  │
                    │           associated_data,   │
                    │           key_id, nonce)     │
                    │  Stored: versioned key_id    │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Vault (pgsodium.key)       │
                    │  key_id → raw key material  │
                    │  Access: postgres role only │
                    │  Rotation: new key_id       │
                    └─────────────────────────────┘
```

- `associated_data` (AAD) = `patient_id::text` or `table:column:row_id` — binds ciphertext to owner, prevents cut-and-paste across patients.
- Decryption happens **only inside Postgres** via `SECURITY DEFINER` view/function that checks `auth.uid()` / `therapist_owns_patient()` before decrypting — leaked snapshot without Vault keys is useless.
- API reads via a **decrypting view** (e.g., `soap_notes_decrypted`) that the app queries instead of base table; writes go through an encrypting function/trigger.

### 2.4 Schema sketch (migration outline)

```sql
-- 0. Prerequisites (Supabase Dashboard → Vault → create key, or SQL)
CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;
-- Vault key created once; id captured for migrations
-- SELECT pgsodium.create_key(name := 'aruga_phi_key_v1');

-- 1. Add ciphertext columns (dual-write phase — plaintext + ciphertext coexist)
ALTER TABLE soap_notes
  ADD COLUMN IF NOT EXISTS subjective_ct BYTEA,
  ADD COLUMN IF NOT EXISTS objective_ct BYTEA,
  ADD COLUMN IF NOT EXISTS assessment_ct BYTEA,
  ADD COLUMN IF NOT EXISTS plan_ct BYTEA,
  ADD COLUMN IF NOT EXISTS client_summary_ct BYTEA,
  ADD COLUMN IF NOT EXISTS enc_key_id UUID,          -- which Vault key version
  ADD COLUMN IF NOT EXISTS enc_v SMALLINT NOT NULL DEFAULT 1;

-- 2. Encrypting helper (SECURITY DEFINER — checks ownership before encrypt)
CREATE OR REPLACE FUNCTION encrypt_phi(plaintext TEXT, aad TEXT, key_id UUID)
RETURNS BYTEA LANGUAGE sql SECURITY DEFINER SET search_path=public, pgsodium AS $$
  SELECT CASE WHEN plaintext IS NULL THEN NULL
         ELSE pgsodium.crypto_aead_det_encrypt(
                convert_to(plaintext, 'utf8'), convert_to(aad, 'utf8'), key_id, NULL)
         END;
$$;

CREATE OR REPLACE FUNCTION decrypt_phi(ciphertext BYTEA, aad TEXT, key_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path=public, pgsodium AS $$
  SELECT CASE WHEN ciphertext IS NULL THEN NULL
         ELSE convert_from(
                pgsodium.crypto_aead_det_decrypt(ciphertext, convert_to(aad, 'utf8'), key_id, NULL),
                'utf8')
         END;
$$;

-- 3. Decrypting view (API reads this; RLS on base table still applies)
CREATE OR REPLACE VIEW soap_notes_decrypted
WITH (security_invoker = true) AS
SELECT id, patient_id, therapist_id,
       decrypt_phi(subjective_ct, patient_id::text, enc_key_id) AS subjective,
       decrypt_phi(objective_ct,   patient_id::text, enc_key_id) AS objective,
       decrypt_phi(assessment_ct,  patient_id::text, enc_key_id) AS assessment,
       decrypt_phi(plan_ct,        patient_id::text, enc_key_id) AS plan,
       decrypt_phi(client_summary_ct, patient_id::text, enc_key_id) AS client_summary,
       created_at, updated_at, enc_key_id, enc_v
FROM soap_notes;

-- 4. Trigger: on INSERT/UPDATE, populate *_ct from plaintext (dual-write period)
--    After backfill verified, drop plaintext columns and make *_ct NOT NULL.

-- 5. Deterministic encryption for patients.email (searchable equality)
--    pgsodium.crypto_aead_det_encrypt is deterministic when nonce derived from key;
--    equality search via ciphertext comparison; LIKE/prefix search not supported.
```

**Search story:**

- Exact-match (`email = ?`) → encrypt query term with same key, compare ciphertext (deterministic).
- Full-text / prefix / `ILIKE` → not possible on ciphertext; options: (a) keep a separate `email_trgm` HMAC-indexed column, (b) application-level search on decrypted view with rate limits, (c) accept no encrypted-column search (recommended for clinical narrative).
- Recommended: encrypt narrative columns (no search), deterministic-only for `email`.

### 2.5 Migration steps (zero-downtime)

1. **Provision Vault key** (`aruga_phi_key_v1`) and store `key_id` in `vault.keys` — capture UUID for migrations.
2. **Add `*_ct` columns** nullable, keep plaintext columns — deploy trigger that dual-writes both.
3. **Backfill** existing rows: `UPDATE soap_notes SET subjective_ct = encrypt_phi(subjective, patient_id::text, :key_id) WHERE subjective_ct IS NULL` in batches (1k rows, with `pg_sleep` to avoid lock contention).
4. **Verify** — `SELECT count(*) WHERE subjective IS NOT NULL AND subjective_ct IS NULL` = 0; spot-decrypt sample rows and compare.
5. **Switch API** — point `src/app/api/therapist/soap-notes/route.ts` and reviews/messages reads to `*_decrypted` views (or keep table but decrypt in SELECT via helper).
6. **Drop plaintext** — `ALTER TABLE soap_notes DROP COLUMN subjective, DROP COLUMN objective, ...` (or retain one release cycle behind feature flag).
7. **Add NOT NULL** to `*_ct` once plaintext gone.

Rollback at any step before (6) is just reverting the view pointer.

### 2.6 Key rotation

- Create `aruga_phi_key_v2` via `pgsodium.create_key()`.
- New writes use `v2`; old rows keep `enc_key_id = v1` until re-encrypted.
- Background job: `UPDATE soap_notes SET subjective_ct = encrypt_phi(decrypt_phi(subjective_ct, ... v1), ..., v2), enc_key_id = v2 WHERE enc_key_id = v1` in batches.
- Old key retained (read-only) until re-encryption verified, then revoked in Vault — never deleted outright (needed for old backups).

### 2.7 Trade-offs

| Pros | Cons |
|---|---|
| Snapshot/replica exfiltration → ciphertext | ~5–15% read overhead (AEAD decrypt per row) |
| Vault-backed, auditable, rotatable without app secret rotation | No `LIKE`/`ILIKE`/FTS on encrypted columns |
| Transparent to RLS — policy still on plaintext FKs | Deterministic `email` leaks equality (acceptable for email; not for narrative) |
| Works with `service_role` pattern already in use | Requires Supabase Vault enabled (paid tier) |
| Backup remains encrypted at rest + ciphertext | Slightly larger storage (nonce+tag ~40 B/column) |

### 2.8 When to ship Track A

**Ship first** if BAA review flags "encryption at rest with customer-managed keys" or snapshot risk is top concern. It is strictly server-side, no UX change, and unblocks enterprise pilots.

---

## 3. Track B — Client-Side End-to-End Encryption (WebCrypto Envelope)

Protects PHI even from Aruga's own servers / DBAs / subpoenas — only the therapist and assigned client can decrypt.

### 3.1 Threats it addresses that Track A does not

- Compromised `service_role` key or `postgres` superuser.
- Malicious insider with DB + Vault access.
- Legal compulsion to produce plaintext from server.
- Cloud provider compelled disclosure.

### 3.2 What E2E means here (and does not)

- **Envelope E2E**, not pure P2P — server stores/transports ciphertext, never sees plaintext or long-term private keys.
- Scope: `messages.body`, `soap_notes` narrative, `submission_reviews` feedback, and optionally video `media_meta` annotations. **Not** routing metadata (`patient_id`, `sender_id`, timestamps) — server needs those for delivery/RLS.
- AI features (Muse Spark SOAP drafting, SAM) require **explicit per-message consent** to decrypt server-side; otherwise AI is disabled for E2E threads (or runs on redacted/consented excerpts).

### 3.3 Crypto design

```
Per-patient (or per-thread) Data Encryption Key (DEK):
  AES-256-GCM, 96-bit IV, 128-bit tag — random per message/note, or per
  patient with per-row IV (prefer per-row DEK for forward secrecy, or
  per-patient DEK + per-row IV for simplicity).

Key Envelope:
  For each recipient (therapist + client), wrap DEK with recipient's
  public key using ECDH (P-256/X25519) + HKDF + AES-KW, or directly
  RSA-OAEP if using WebAuthn-stored keys.
  Stored envelope: { recipient_id, wrapped_dek, ephemeral_pubkey, iv, tag }.

Long-term Identity Keys:
  Per-user ECDH keypair (P-256 or X25519), generated in browser via
  WebCrypto, private key in IndexedDB (extractable:false) + optional
  OPFS backup, public key published to profiles.e2ee_pubkey (plaintext).

Flow (send):
  1. Sender generates random DEK (or reuses patient DEK).
  2. Encrypt plaintext: AES-GCM(DEK, plaintext, aad=patient_id) → ciphertext.
  3. For each recipient, ECDH(sender_priv, recipient_pub) → shared secret → wrap DEK.
  4. Upload { ciphertext, envelopes[], iv, aad_hash } to API — server stores opaque blobs.
  5. Server never sees DEK or plaintext.

Flow (read):
  1. Client fetches ciphertext + its envelope.
  2. ECDH(recipient_priv, ephemeral_pub) → unwrap DEK.
  3. AES-GCM decrypt → plaintext in memory, never persisted plaintext on disk
     except optional IndexedDB cache with same DEK.
```

### 3.4 Key distribution & recovery (hardest part)

| Problem | Options | Recommended |
|---|---|---|
| Initial keypair creation | On signup, `crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'})` | P-256 (WebCrypto native); X25519 if `noble-curves` polyfill acceptable |
| Public key publish | `PATCH /api/profile/e2ee-key { pubkey_b64 }` — server stores, serves to peers | Plaintext pubkey, no trust issue |
| Private key storage | `IndexedDB` non-extractable + `navigator.credentials` (WebAuthn PRF extension) as backup | IndexedDB primary; WebAuthn PRF as recovery anchor (Chrome 120+) |
| Device loss / new device | Recovery via: (a) passphrase-wrapped export, (b) therapist-assisted re-invite, (c) Vault escrow (breaks true E2E) | **(a)+(b)**: prompt user to export recovery phrase on first keygen; new device triggers re-envelope of patient DEK by peer |
| Therapist transfer (`previous_therapist_id`) | Old therapist's envelopes remain; new therapist gets fresh envelope on transfer | Transfer endpoint re-wraps patient DEK for new therapist after consent |
| Group (caregiver + client + therapist) | One envelope per recipient (3 envelopes/row) | Scales to ~5 recipients; beyond that use MLS-inspired group DEK (future) |

**Non-goal for v1:** deniability, post-compromise security — add Signal-style ratchet later if needed.

### 3.5 UX flows

1. **Onboarding:** "Secure Messaging — generate recovery phrase" modal; `12-word BIP39` or `base64` passphrase; user must confirm write-down before enabling E2E.
2. **Per-patient toggle:** Therapist enables "End-to-end encrypted thread" when creating `patients` row; client sees lock icon; existing plaintext threads stay plaintext (no retroactive encrypt).
3. **AI consent gate:** Before `draftTherapistFeedback` or `analyzeStepVideo`, show "Share decrypted excerpt with Meta AI? This sends de-identified text to `api.meta.ai`" — if declined, therapist writes SOAP manually.
4. **Degraded UX:** Search inside E2E threads is client-side only (decrypt + filter in memory); server search disabled for those threads.
5. **Video:** Thumbnails/messages E2E; raw video bytes remain storage-encrypted (C2 short URLs) — full E2E video would require chunked MediaSource encryption (defer to v2).

### 3.6 Implementation phases

```
Phase 1 — Keys & envelopes (2–3 weeks)
  - WebCrypto keygen + IndexedDB store (src/lib/e2ee/keys.ts)
  - Pubkey publish + fetch endpoints
  - Envelope encrypt/decrypt helpers (src/lib/e2ee/envelope.ts)

Phase 2 — Messages E2E (2 weeks)
  - Toggle on messages thread (messages.e2ee_enabled BOOL)
  - Send path wraps DEK, stores ciphertext in messages.body_ciphertext
  - Read path unwraps in browser (src/app/(app)/messages/thread.tsx)

Phase 3 — SOAP & reviews E2E (2 weeks)
  - Same envelope pattern for soap_notes / submission_reviews
  - Decrypting view replaced by client-side decrypt for E2E rows

Phase 4 — Recovery & transfer (2 weeks)
  - Recovery phrase + WebAuthn PRF backup
  - Transfer re-envelope flow
  - Admin "recovery audit log" (who re-enveloped, when)

Phase 5 — Hardening (1 week)
  - CSP + SRI for crypto code, SubtleCrypto audit
  - Pen test: key exfiltration via XSS, envelope replay
```

### 3.7 Trade-offs

| Pros | Cons |
|---|---|
| Server compromise → ciphertext only | Lost private key = lost history (mitigated by recovery phrase) |
| Insider / subpoena resistance | AI features need explicit decrypt consent |
| No Vault/BAA dependency for confidentiality | Client-only search; no server FTS on E2E rows |
| Per-patient isolation even if RLS bypassed | WebCrypto only in secure contexts (HTTPS); no HTTP dev without localhost |
| Forward secrecy if per-message DEK | ~10–30 ms decrypt overhead per thread load (negligible vs network) |

### 3.8 When to ship Track B

**After Track A** unless a customer explicitly requires zero-trust / subpoena resistance. Track B is higher UX cost and conflicts with AI-assisted SOAP — needs product decision on "AI vs E2E" per thread.

---

## 4. Comparison & Recommendation

| Dimension | Track A: Column-Level (pgsodium) | Track B: E2E (WebCrypto) |
|---|---|---|
| Protects against snapshot theft | ✅ | ✅ |
| Protects against `service_role` leak | ✅ (needs Vault key too) | ✅ (server never has DEK) |
| Protects against Vault + DB compromise | ❌ | ✅ |
| Protects against insider with prod access | ✅ | ✅ |
| AI features (Muse Spark / SAM) | ✅ transparent | ⚠️ needs consent gate |
| Search / filtering | Deterministic `email` only | Client-side only |
| Key management | Vault (ops-owned) | User-owned + recovery phrase |
| UX impact | None | Onboarding + recovery UX |
| Implementation cost | ~1 week + migration | ~8–10 weeks across 5 phases |
| BAA readiness | Strengthens BAA posture | Strongest, but BAA still needed for metadata |
| Recommended order | **First** | **Second**, per-customer opt-in |

**Recommended path:**

1. **Q4 2026 (done):** RLS/API hardening (`supabase/RUN_ONCE_PRIVACY_FIX*.sql`, `scripts/verify-rls.sql:1`).
2. **Q1 2027:** Track A for `soap_notes`, `submission_reviews`, `messages.body`, `patients.email` — unblocks BAA + enterprise.
3. **Q2 2027:** Track B pilot for a single clinic that opts into E2E messages + SOAP (AI off by default for E2E threads) — measure UX/retention before broad rollout.
4. **H2 2027:** Evaluate group E2E (caregiver) and chunked video E2E if demand warrants.

No data is re-encrypted twice; Track B rows bypass Track A (E2E ciphertext stored directly, not double-wrapped).

---

## 5. Phased Rollout

```
Week 0        Current: TLS + AES-256 at-rest + RLS/API guards
              Artifacts: supabase/RUN_ONCE_PRIVACY_FIX.sql
                         supabase/RUN_ONCE_PRIVACY_FIX_C3_DROP_OPEN_POLICIES.sql
                         docs/PRIVACY_HARDENING_LATEST.md
                         scripts/verify-rls.sql

Q1 2027 TCE   Enable Vault + pgsodium → add *_ct columns → dual-write →
             backfill → switch views → drop plaintext → rotate drill
             Gate: penetration test on decrypting views (RLS bypass attempt)

Q2 2027 E2E   WebCrypto keys → envelopes → messages E2E → SOAP E2E →
             recovery + transfer → CSP/SRI audit
             Gate: external crypto review of envelope impl + XSS exfil test

H2 2027+      Group E2E, video chunk E2E, MLS ratchet — only if pilot validates
```

Feature flags: `ENCRYPTION_MODE=none|tce|e2e` (DB) and `E2E_ENABLED=true|false` per patient/thread.

---

## 6. Key Rotation & Recovery

### 6.1 Column-level (Track A)

- **Scheduled:** 12-month rotation (`v1 → v2`) via new Vault key + background re-encrypt job (idempotent, batched).
- **Emergency:** Vault key revocation → immediate `enc_key_id` invalidation; rows with revoked key fail decrypt loudly (alert, not silent NULL).
- **Backups:** Old Vault keys retained read-only for backup decrypt; never auto-purged — manual ceremony with two approvers.

### 6.2 E2E (Track B)

- **Per-message DEK:** No rotation needed — each row is independent.
- **Per-patient DEK:** Rotate on therapist transfer or annually — re-envelope for all recipients, old envelopes kept for history.
- **Identity key (ECDH):** Rotate on device loss — publish new pubkey, peers re-envelope patient DEKs for new pubkey; old privkey kept until history re-enveloped or user confirms drop.
- **Recovery:** Passphrase-wrapped export (PBKDF2 + AES-GCM) stored by user; optional therapist-assisted re-invite (new DEK, old history stays under old DEK until re-enveloped).

---

## 7. Compliance & Audit Implications

| Obligation | Track A effect | Track B effect |
|---|---|---|
| HIPAA Encryption (§164.312(a)(2)(iv)) | Satisfies "encryption at rest" beyond volume encryption; supports BAA claim | Exceeds it; server cannot produce plaintext |
| HIPAA Access Control (§164.312(a)(1)) | RLS + decrypting view preserves need-to-know | Envelope recipients = access list |
| Audit Controls (§164.312(b)) | Vault key usage + `audit_events` for decrypt attempts | Envelope open + re-envelope logged |
| Breach Notification (Hitech) | Ciphertext-only breach may qualify for safe harbor (no notification if keys uncompromised) | Same, stronger |
| eDiscovery / legal hold | Server can still produce plaintext (Vault key) — hold feasible | Server cannot; must collect from client devices (legal implication to disclose) |
| SOC 2 / HITRUST | TCE is expected control; auditors will ask for rotation evidence | Bonus, not required |

> **Note:** Neither track removes the need for a BAA with Supabase/Vercel, workforce training, or RLS — they are defense-in-depth, not substitutes.

---

## 8. Open Questions

1. **AI vs E2E policy:** Does enabling E2E on a thread permanently disable `draftTherapistFeedback` for that thread, or allow per-message opt-in decrypt? Product + legal input needed.
2. **Caregiver as recipient:** Is caregiver a full E2E participant (needs keypair) or does client share decrypted view? Affects envelope count and UX complexity.
3. **Email search:** Is deterministic encryption for `patients.email` required, or can we accept app-layer search on decrypted view for the ~1k-patient scale?
4. **Vault tier:** Which Supabase plan unlocks Vault + `pgsodium` for prod? Confirm before committing Q1 timeline.
5. **Video E2E:** Is message/SOAP E2E sufficient, or must raw video bytes be E2E (significant MediaSource work)?
6. **Key escrow for minors:** For `pedia` (Caregiver Co-Runner), does legal guardian require escrowed access even under E2E? State-dependent.

---

## References

- Current hardening: `docs/PRIVACY_HARDENING_LATEST.md:1` and `docs/PRIVACY_HARDENING_C1-H4_1101260315.md:1`
- Consolidated fix: `supabase/RUN_ONCE_PRIVACY_FIX.sql:1` + `supabase/RUN_ONCE_PRIVACY_FIX_C3_DROP_OPEN_POLICIES.sql:1`
- RLS audit: `scripts/verify-rls.sql:1` (buckets `public=false`, `qual=true` → 0 rows, `relrowsecurity`, `therapist_owns_patient`)
- Audits: `audit/HIPAA_COMPLIANCE_AUDIT_1101260315.md:1`, `audit/audit_report_1101260315.md:1`, `audit/BUSINESS_MODEL_CANVAS_V4_1101260315.md:1` (stable copies in `docs/*_LATEST.md`)
- Supabase Vault + pgsodium: https://supabase.com/docs/guides/database/vault, https://supabase.com/docs/guides/database/extensions/pgsodium

*Last updated: 2026-11-01. Owner: Aruga security track. Next review: after Track A Vault provisioning.*
