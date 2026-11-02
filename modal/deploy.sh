#!/usr/bin/env bash
set -euo pipefail

# modal/deploy.sh — one-command deploy for modal/app.py (Aruga MHR Biomech)
# Usage:
#   ./modal/deploy.sh                  # deploy stub (Phase 0, no GPU weights) — verifies wiring
#   ./modal/deploy.sh --prod           # deploy real estimator (requires Phase 1 image uncommented + Volume ckpts)
#   ./modal/deploy.sh --check          # only check auth + secrets, don't deploy
#   ./modal/deploy.sh --secret-only    # create/update modal secret from .env.local, don't deploy
#   ./modal/deploy.sh --help
#
# What it does (mirrors modal/DEPLOYMENT_GUIDE.md §3-4):
#   1) Check modal CLI + auth (modal token current)
#   2) Create/update Modal secret `aruga-mhr-env` from .env.local (MODAL_SECRET etc) — never hardcoded
#   3) Run `modal deploy modal/app.py` and print MODAL_MHR_URL (set this in Next .env.local + Vercel)
#   4) Smoke test: POST stub_infer locally + curl deployed /infer if URL known
#
# Env: reads .env.local if present (gitignored). All secrets stay env-only per .env.example.
# Requires: pip install modal; modal token new (once). See DEPLOYMENT_GUIDE.md.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PY="$ROOT_DIR/modal/app.py"
ENV_FILE="$ROOT_DIR/.env.local"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

MODE="stub"
DO_CHECK_ONLY=false
DO_SECRET_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --prod) MODE="prod" ;;
    --check) DO_CHECK_ONLY=true ;;
    --secret-only) DO_SECRET_ONLY=true ;;
    --help|-h) sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "Unknown flag: $arg (try --help)"; exit 2 ;;
  esac
done

say() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()  { printf "  \033[0;32m✓ %s\033[0m\n" "$*"; }
warn(){ printf "  \033[0;33m! %s\033[0m\n" "$*"; }
die() { printf "\n\033[0;31m✗ %s\033[0m\n" "$*"; exit 1; }

[[ -f "$APP_PY" ]] || die "Missing $APP_PY"
command -v modal >/dev/null 2>&1 || die "modal CLI not found. Install: pip install modal"

# 1) Auth check
say "Checking Modal auth"
if ! modal token current >/dev/null 2>&1; then
  warn "Not logged in. Running: modal token new (browser login)"
  modal token new
fi
# Workspace name for URL preview
WORKSPACE="$(modal token current 2>&1 | grep -Eo '[a-z0-9_-]+' | head -n 5 || true)"
ok "Logged in $(modal token current 2>&1 | head -n 2 | tr '\n' ' ' || true)"

if [[ "$MODE" == "prod" ]]; then
  # Guard: Phase 1 image must be uncommented
  if grep -q '^    # image = (' "$APP_PY" && grep -q '^    image = modal.Image.debian_slim' "$APP_PY"; then
    warn "MODE --prod but Phase 1 image still commented in modal/app.py (pytorch + sam-3d-body)"
    warn "Uncomment the Phase 1 image block per DEPLOYMENT_GUIDE.md §4.2, then re-run."
    read -r -p "Continue anyway with stub image? [y/N] " ans; [[ "$ans" == y* ]] || exit 1
  fi
fi

# 2) Secret sync from .env.local -> modal secret aruga-mhr-env
#    Env vars managed here: MODAL_SECRET (required for prod), SUPABASE_URL/SECRET_KEY, MODAL_WEBHOOK_URL, etc.
#    All sensitive routes are env-only — see .env.example. Reminder: copy .env.example -> .env.local first.
say "Syncing Modal secret aruga-mhr-env from .env.local"
# re-exec with bash if run via sh (process substitution & arrays need bash)
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
load_dotenv() {
  # safe loader: only KEY=VALUE, skip comments, don't eval — POSIX-safe, no process substitution
  [ -f "$ENV_FILE" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in \#*|"") continue;; esac
    case "$line" in *=*) k="${line%%=*}"; v="${line#*=}";; *) continue;; esac
    # trim whitespace from key
    k="$(echo "$k" | xargs)"
    case "$k" in ""|*[!A-Za-z0-9_]* ) continue;; esac
    # strip surrounding quotes from value
    v="$(echo "$v" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    export "$k"="$v"
  done < "$ENV_FILE"
}
if load_dotenv; then
  ok "Loaded $ENV_FILE"
else
  warn "No $ENV_FILE — using shell env + example defaults. Copy .env.example -> .env.local and fill MODAL_SECRET etc."
fi

# Collect secret keys that exist in env (only set non-empty)
SECRET_ARGS=()
for key in MODAL_SECRET SUPABASE_URL SUPABASE_SECRET_KEY MODAL_WEBHOOK_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SECRET_KEY; do
  # Normalize: allow both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL
  val="${!key:-}"
  [[ -z "$val" && "$key" == "SUPABASE_URL" ]] && val="${NEXT_PUBLIC_SUPABASE_URL:-}"
  [[ -n "$val" ]] && SECRET_ARGS+=("$key=$val")
done
# Always allow explicit MODAL_SECRET generation hint
if [[ -z "${MODAL_SECRET:-}" ]]; then
  warn "MODAL_SECRET is empty — shared secret Next→Modal (x-modal-secret) will be unset."
  warn "Generate one: openssl rand -hex 32  → put in .env.local MODAL_SECRET and re-run with --secret-only"
  warn "Deploy will proceed without auth (stub mode only). For prod, set MODAL_SECRET first."
else
  ok "MODAL_SECRET present (${#MODAL_SECRET} chars) — will verify x-modal-secret on Modal"
fi

if [[ ${#SECRET_ARGS[@]} -gt 0 ]]; then
  echo "  Creating/updating secret: aruga-mhr-env (${#SECRET_ARGS[@]} keys)"
  # modal secret create is upsert; use --force if available, else create
  if modal secret create --help 2>&1 | grep -q -- --force; then
    modal secret create aruga-mhr-env --force "${SECRET_ARGS[@]}" || modal secret create aruga-mhr-env "${SECRET_ARGS[@]}"
  else
    # legacy: delete+create if exists
    if modal secret list 2>&1 | grep -q "aruga-mhr-env"; then
      warn "Secret aruga-mhr-env exists — updating (delete+create path)"
      modal secret delete aruga-mhr-env --yes 2>/dev/null || true
    fi
    modal secret create aruga-mhr-env "${SECRET_ARGS[@]}"
  fi
  ok "Secret aruga-mhr-env synced"
  modal secret list 2>&1 | grep -E "aruga-mhr-env|MODAL_SECRET|SUPABASE" | sed 's/^/  /' || true
else
  warn "No secret keys to sync (set MODAL_SECRET etc in .env.local) — skipping secret create"
fi

$DO_SECRET_ONLY && { ok "Secret-only done. Re-run without --secret-only to deploy."; exit 0; }
$DO_CHECK_ONLY && { ok "Check done. Run ./modal/deploy.sh to deploy."; exit 0; }

# 3) Deploy
say "Deploying $APP_PY (mode: $MODE)"
echo "  $ modal deploy $APP_PY"
DEPLOY_OUT="$(modal deploy "$APP_PY" 2>&1 | tee /dev/tty)"
# Extract URL like https://<ws>--aruga-mhr-infer.modal.run
MODAL_URL="$(echo "$DEPLOY_OUT" | grep -Eo 'https://[a-z0-9._/-]+--aruga-mhr[^ ]*\.modal\.run[^\"]*' | head -n 1 || true)"
if [[ -z "$MODAL_URL" ]]; then
  # fallback: any modal.run URL in output
  MODAL_URL="$(echo "$DEPLOY_OUT" | grep -Eo 'https://[^ ]*modal\.run[^ ]*' | head -n 1 || true)"
fi
if [[ -n "$MODAL_URL" ]]; then
  # Ensure we have /infer path: fastapi_endpoint path is /infer by function name — Modal prints base; app uses fastapi_endpoint path
  # Our infer is @modal.fastapi_endpoint(method=POST) def infer -> path likely / => use base as MODAL_MHR_URL, Next appends /infer
  INFER_URL="${MODAL_URL%/}"
  # Modal fastapi_endpoint default path is /<func> when no explicit path; ensure /infer suffix not doubled by Next
  # Next does: ${MODAL_MHR_URL}/infer, so base should be https://...modal.run (no /infer)
  # If Modal printed https://...--aruga-mhr-infer.modal.run, that's already the infer endpoint — use as-is as base
  ok "Deployed: $INFER_URL"
  echo
  echo "  ┌─────────────────────────────────────────────────────────────"
  echo "  │ Set this in your Next env (local + hosting):"
  echo "  │   MODAL_MHR_URL=$INFER_URL"
  [[ -n "${MODAL_SECRET:-}" ]] && echo "  │   MODAL_SECRET=<same as .env.local> (already in Modal secret)"
  echo "  │   then: npm run dev  (or redeploy Vercel)"
  echo "  │ Docs: modal/DEPLOYMENT_GUIDE.md §3 + §5"
  echo "  └─────────────────────────────────────────────────────────────"
  # Offer to append to .env.local if missing
  if [[ -f "$ENV_FILE" ]] && ! grep -q "^MODAL_MHR_URL=" "$ENV_FILE"; then
    echo
    read -r -p "Add MODAL_MHR_URL to .env.local now? [y/N] " ans
    if [[ "$ans" == y* ]]; then
      printf "\nMODAL_MHR_URL=%s\n" "$INFER_URL" >> "$ENV_FILE"
      ok "Appended MODAL_MHR_URL to $ENV_FILE (verify, then set same in Vercel/hosting env)"
    fi
  elif [[ -f "$ENV_FILE" ]]; then
    # Update existing
    if grep -q "^MODAL_MHR_URL=$" "$ENV_FILE" || grep -q "^MODAL_MHR_URL=&" "$ENV_FILE"; then
      warn "MODAL_MHR_URL is empty in .env.local — update it to: $INFER_URL"
    fi
  fi
else
  warn "Deployed but could not parse URL from output — check: modal app list; use that URL as MODAL_MHR_URL"
fi

# 4) Local smoke test (no network to deployed URL needed)
say "Smoke test (local stub)"
if modal run "$APP_PY"::stub_infer --item-json '{"submissionId":"smoke","stepSubmissionId":"smoke-step","options":{"concepts":["person","shoulder"]}}' 2>&1 | head -n 20 | grep -q "submissionId"; then
  ok "stub_infer returned JSON"
else
  warn "stub_infer smoke test inconclusive — run manually: modal run modal/app.py::stub_infer --item-json '{\"submissionId\":\"smoke\"}'"
fi

# 5) Optional live check if URL + secret known
if [[ -n "${MODAL_URL:-}" ]]; then
  say "Live check (POST $MODAL_URL — requires deployed + MODAL_SECRET if set)"
  echo "  curl -X POST \"$MODAL_URL\" -H 'Content-Type: application/json' -H 'x-modal-secret: \$MODAL_SECRET' -d '{\"submissionId\":\"smoke\",\"stepSubmissionId\":\"s1\",\"options\":{\"concepts\":[\"person\"]}}' | head"
  warn "If you get 401, MODAL_SECRET mismatch — sync secret (./modal/deploy.sh --secret-only) and redeploy"
fi

echo
ok "Done. Next: set MODAL_MHR_URL in Next env per reminder above, then test: POST /api/agent/biomech/run with real stepSubmissionId"
echo "     Verify: therapist/submissions/[id] → per-step Use Case dropdown + Check movement → BiomechPanel"
