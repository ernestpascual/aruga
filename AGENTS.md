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

