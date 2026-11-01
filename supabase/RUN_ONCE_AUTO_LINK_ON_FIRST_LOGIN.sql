-- RUN_ONCE_AUTO_LINK_ON_FIRST_LOGIN.sql
-- Auto-link therapist-created clients when they first log in.
-- Complements src/app/api/auth/clear-temp-credentials/route.ts auto-accept logic.
-- Safe to run repeatedly (CREATE OR REPLACE + DROP IF EXISTS).

-- Trigger: when a pending therapist-initiated invite gets its first_login_at set
-- (or client_user_id linked), flip invitation_status to 'accepted' automatically.
CREATE OR REPLACE FUNCTION public.auto_accept_on_first_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Case 1: first_login_at transitions from NULL -> NOT NULL
  IF (OLD.first_login_at IS NULL AND NEW.first_login_at IS NOT NULL)
     AND OLD.invitation_status = 'pending'
     AND NEW.therapist_id IS NOT NULL THEN
    NEW.invitation_status := 'accepted';
  END IF;

  -- Case 2: client_user_id linked for first time (invite-before-signup flow)
  IF (OLD.client_user_id IS NULL AND NEW.client_user_id IS NOT NULL)
     AND OLD.invitation_status = 'pending'
     AND NEW.therapist_id IS NOT NULL THEN
    NEW.invitation_status := 'accepted';
    -- Also set first_login_at if not already set
    IF NEW.first_login_at IS NULL THEN
      NEW.first_login_at := NOW();
    END IF;
  END IF;

  -- Case 3: any update that sets first_login_at while pending -> accept
  -- (covers bulk updates via API that set credentials_cleared_at + first_login_at)
  IF (NEW.first_login_at IS NOT NULL AND OLD.invitation_status = 'pending' AND NEW.invitation_status = 'pending'
      AND NEW.therapist_id IS NOT NULL) THEN
    NEW.invitation_status := 'accepted';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_accept_on_first_login ON public.patients;
CREATE TRIGGER trg_auto_accept_on_first_login
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.auto_accept_on_first_login();

-- One-time backfill: any already-logged-in but still-pending therapist invites -> accept
-- (idempotent, safe to re-run)
UPDATE public.patients
SET invitation_status = 'accepted', updated_at = NOW()
WHERE invitation_status = 'pending'
  AND therapist_id IS NOT NULL
  AND first_login_at IS NOT NULL;
