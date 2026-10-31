<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## STRICT SECURITY RULE: NEVER READ .env* FILES
DO NOT READ, VIEW, CAT, GREP, PRINT, OR EXPOSE `.env.local`, `.env`, `.env.*`, OR ANY ENVIRONMENT SECRET FILES UNDER ANY CIRCUMSTANCES.

## AUDIT PROTOCOL: DUAL MARKDOWN & INTERACTIVE HTML (STRICT REQUIREMENT)
Whenever performing, generating, or updating audits (e.g. within the `audit/` folder):
1. **Markdown First**: ALWAYS generate the comprehensive markdown report file (`.md`) first, formatted and appended with the exact timestamp in the format `MMDDYYHHMM` (e.g. `audit_report_1029260313.md` or `BUSINESS_MODEL_CANVAS_V1_1029260349.md`).
2. **Interactive HTML Report**: Immediately follow up by creating a standalone, interactive HTML report (`.html`) with the exact same base name (e.g. `audit_report_1029260313.html`).
3. **Interactive Report Requirements**:
   - Must use Aruga's dark clinical design system (dark zinc `#09090b` / `#121215`, teal accents `#14b8a6`, amber `#f59e0b`, sky `#0284c7`, modern typography like Inter/JetBrains Mono).
   - Must include dynamic interactive features: live compute/cost sliders, interactive searchable checklists with completion metrics, tabbed views, tier comparators, and print/PDF optimization.
   - Must be fully self-contained (embedded CSS and vanilla JS, zero external runtime build dependencies).
4. **Never Deliver a Markdown Audit Without its Interactive HTML Companion**.
5. **Versioning & Archival (Timestamped, Old → LATEST)**:
   - Every audit/canvas/HIPAA artifact MUST be timestamped `MMDDYYHHMM` in its filename (e.g. `audit_report_1101260151.md`, `HIPAA_COMPLIANCE_AUDIT_1101260151.html`, `BUSINESS_MODEL_CANVAS_V2_1031261420.md`).
   - Before publishing a new version, move ALL superseded timestamped versions of the same family to the `old/` subdirectory — `audit/old/` for audits/HIPAA/canvas history and `docs/old/` for any versioned docs — preserving their full timestamped filenames (never rename or overwrite history).
   - The root of `audit/` and the root of `docs/` must contain ONLY the latest authoritative version of each family. `audit/` keeps the latest timestamped pair as source of truth (e.g. `audit_report_1101260151.*`, `HIPAA_COMPLIANCE_AUDIT_1101260151.*`, `BUSINESS_MODEL_CANVAS_V2_1031261420.*`); `docs/` holds a stable `*_LATEST.*` convenience copy (e.g. `docs/AUDIT_REPORT_LATEST.*`, `docs/HIPAA_AUDIT_LATEST.*`, `docs/BUSINESS_MODEL_CANVAS_LATEST.*`) synced from `audit/`.
   - Update cross-links when archiving: previous-version references in the new audit must point to `old/` (e.g. `old/audit_report_1031262200.md`) and `README.md` / index pages must point to the new latest. Never leave dangling links to moved files.
   - Maintain `audit/old/README.md` and `docs/old/README.md` as the archive index describing what was archived, when, and what is now latest.

