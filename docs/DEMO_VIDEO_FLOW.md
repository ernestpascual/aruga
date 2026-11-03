# Aruga — Demo Video Flow & Highlight Guide (3-Minute Submission Cut)

**Document:** `DEMO_VIDEO_FLOW` · Created 2026-11-03
**Requirement source:** Meta Global AI Developer Hackathon Participant Guide §7 — **3-minute demo video**, a primary judging artifact (Stage Three finalists are re-judged live *on the video*)
**Brand/message source:** [BRAND_AND_MESSAGING_GUIDE.md](BRAND_AND_MESSAGING_GUIDE.md) · **Evidence source:** [RESEARCH_SYNTHESIS.md](../studies/RESEARCH_SYNTHESIS.md) (§9 discipline binding) · **Scoring source:** [HACKATHON_WINNING_CONDITIONS_1103261726.md](../audit/HACKATHON_WINNING_CONDITIONS_1103261726.md)
**Interactive companion:** [DEMO_VIDEO_FLOW.html](DEMO_VIDEO_FLOW.html)

> **The one rule:** record the **judge-local path itself** (unauthenticated playgrounds, your machine, your footage) — the video must show exactly what judges will run. If a shot can't be reproduced by a judge in 10 minutes with only a Meta key, it doesn't go in the video.

---

## 1. At a Glance

| Property | Spec |
|---|---|
| Runtime | **3:00 hard cap** (guide §7) — target 2:50 to leave margin |
| Structure | Problem (literature) → Twin hero → Simulation replay → Dynamic validation → Hyperpersonal story → Agentic workflow → Lineage close |
| Feature order | #1 Twin → #4 Replay → #2 Goal Validation → #3 Highlights → #5 Async Loop (per Brand Guide §4) |
| Capture | Screen-record the local app (`/tools/biomech`, `/sam-test`, client dashboard) + 1 phone-shot clip of a real person practicing (consented/self) |
| Fallback rule | Biomech shown from a **pre-run saved result**; live inference is the backup narrative, never the live dependency (Modal CPU 90–130s) |
| Audio | Voiceover recorded separately; captions burned in (judges watch muted) |
| Forbidden frames | Login walls, Supabase dashboards, "93/93", the words *diagnoses/advises/sports/coach/AI therapist* (see §6) |

## 2. Shot-by-Shot Flow (180 seconds)

### 0:00–0:18 — THE INVISIBLE PROBLEM (Impact setup)
- **Show:** A phone video of home practice playing *unmeasured* (plain clip, no overlay), then a therapist's crowded week visual (calendar/inbox abstraction — your UI's caseload list works).
- **Say:** "Therapists prescribe home exercises, then can't see them. The literature is blunt: **50–65% of home practice silently fails** — and the review that does happen is 14 to 20 minutes of eyeballing per patient."
- **Highlight:** the F2 literature number in the first 25 seconds (sourced claims survive judge skepticism). On-screen text: `50–65% of home practice goes unobserved [adherence literature]`.
- **Don't:** open with the logo or "Hi, we're Team…" — judges decide in 10 seconds; spend them on the problem.

### 0:18–0:52 — FEATURE #1: THE MOVEMENT DIGITAL TWIN (hero)
- **Show:** `/tools/biomech` — upload `public/demo/cup_grasp_transfer.mp4` (or your recorded clip) → SAM 3.1 overlay blooms onto the movement → twin view: angle cards (shoulder/elbow/trunk), ROM trend, flags resolving to `Good / Watch`.
- **Say:** "Aruga turns the video patients already record into a **movement digital twin**. Meta SAM 3.1 tracks the anatomy; our SAM 3D Body stage on Modal computes joint angles, range of motion, and compensation flags. Measured — not eyeballed."
- **Highlight:** the *transition* plain-video → overlay → numbers. That morph is the entire invention in one cut; hold it for a full 3 seconds. On-screen: `SAM 3.1 → SAM 3D Body → angles/ROM/flags`.
- **Fallback:** play the saved-result reload (instant) and say "saved once, reopens free" — this also demos the cost discipline.

### 0:52–1:22 — FEATURE #4: SIMULATION REPLAY (the "rewind that" moment)
- **Show:** scrub the timeline — overlay and 3D dot-body stay frame-synced; pause on a flagged moment; switch intent view U1→U5 and watch the *same capture* re-filter (new angles/flags, no re-run spinner).
- **Say:** "Every capture becomes a replayable simulation. Pause it, rewind it, change the clinical lens — one recording, every view, no re-billing. The therapist studies movement the way engineers study a sim."
- **Highlight:** the view switch with *no loading state* — it proves the architecture (one inference, many lenses) without you explaining it.

### 1:22–1:52 — FEATURE #2: DYNAMIC GOAL VALIDATION (agentic proof)
- **Show:** a patient goal card — verdict (`On track`) beside the goal text → submit/new evidence lands → verdict re-computes to a defended state (`At risk` is the more interesting demo: pick the clip that triggers a flag) → expand the agent trace showing the 7 signals.
- **Say:** "Goals aren't paperwork here. After every session, our Goal agent **re-validates every goal against seven signals** and shows its work. Therapists don't chase progress — it's judged continuously, and they publish the call."
- **Highlight:** the trace expanding — this is your verifiable-agents evidence (the guide's Agents 102 theme). Keep it on screen 4+ seconds; it's small text, give judges time to read one line.

### 1:52–2:14 — FEATURE #3: HYPERPERSONAL HIGHLIGHTS (the family's story)
- **Show:** client dashboard — Highlights strip renders (seven moments, real angle deltas) → plain-English summary card ("See Summary") opens instantly.
- **Say:** "And the family gets their month back — seven highlights written from *their* movement, their numbers, in words anyone can read. No two patients' stories are alike, because no two twins are."
- **Highlight:** the delta number inside a highlight ("shoulder 142° → 158°") — personalization you can *see*, not a claim you have to trust. Instant render = the `<15ms` cache story without saying milliseconds on camera (say "instant, and free to re-read").

### 2:14–2:38 — FEATURE #5: ASYNC LOOP + AGENTIC WORKSHEETS (workflow close)
- **Show (fast cuts, 6–8s each):** therapist types shorthand → program drafts → Spark→Muse Image worksheet illustrates → client draws on the sheet → `Send to clinician` verification beat in Aruga Guide.
- **Say:** "All of it asynchronous. Shorthand becomes a program; the program becomes a worksheet drawn for that one child; questions get grounded answers — and anything clinical routes back to the clinician. Nobody schedules anything."
- **Highlight:** the worksheet morph (text → drawn sheet → child's drawing on it). It's the Best-Creative surface and the warmth counterweight to all the measurement — end the product story on a human artifact.

### 2:38–3:00 — LINEAGE & CLOSE (credibility + business)
- **Show:** one frame of the SPOTx 2016 capstone cover → cut to today's repo/product → pricing one-liner card.
- **Say:** "We first designed this in 2016, in the Philippines, because therapists were losing patients to Messenger threads. The idea was right — the measurement technology wasn't. Now it is. Aruga: $49 per intensive patient, the movement twin as a $15 add-on, live today with Meta's models — **care that continues**."
- **Highlight:** the 2016 date on screen while you say it. Unforgeable founder-fit is your closing argument (Build for Your World). Final frame: repo URL + "Built Oct 27–Nov 4, 2026" (the new-work disclosure).

## 3. What to Highlight — Checklist by Judging Category

| Category (weight) | Highlight in video | Where |
|---|---|---|
| **Impact (30%)** | Literature number (50–65%), scarcity context, family-readable outcome, clinic-scale sentence ("a 10-therapist clinic gets ~40 hours back weekly") | 0:00, 1:52, 2:38 |
| **Meta Tooling (25%)** | SAM doing real work (morph), Spark reasoning visible in traces, Muse Image morph, Wonder/Spark picker if it appears naturally — name each model *as it appears on screen* | 0:18, 1:22, 2:14 |
| **Technical (20%)** | No-loading view switch, saved-result instant reload, typed failure honesty (optional 3s: SAM-no-detection state, named not hidden) | 0:52, 1:22 |
| **Demo (25%)** | Real hands/phone footage intercut once (0:00 or worksheet beat), zero login walls, every shot reproducible from JUDGE_DEMO | throughout |

## 4. Production Spec

- **Prep (before record day):** run biomech on the chosen clip and save the result; clear browser of dev clutter; sample data must be *self/consented* (your own movement or a volunteer's, never patient footage); test the full click-path once with a timer.
- **Clip choice:** ≤15s, single person, full limb in frame, good light (the "bad framing suppresses measurement" rule will punish a sloppy clip *on camera*).
- **Recording:** 1080p screen capture, system audio off, voiceover after (script above ≈ 430 words ≈ 2:55 at natural pace); burn captions; audio duck under the morph moments — let the visual land.
- **Takes:** three full takes of 0:18–1:22 (the hero minute); assemble, don't hero-edit. Color: keep the product's own dark UI as the grade.

## 5. Derivative Cuts (make these from the master, free)

| Cut | Length | Source segment | Use |
|---|---|---|---|
| Viral cut | 0:30 | 0:18–0:52 (twin morph only) | X post for Most Viral ($20k, engagement to Nov 8 EOD) |
| Gallery loop | 0:15 silent | Twin replay scrub (0:52) | Community-vote gallery card (muted autoplay) |
| Creative cut | 0:20 | Worksheet morph (2:14) | Best-Creative flag context in submission text |

## 6. Do-Not-Say / Do-Not-Show (claim discipline, RESEARCH_SYNTHESIS §9)

- ❌ "AI diagnoses / advises / treats" · "AI therapist" · "clinical-grade angles" · "replaces therapy" · "93/93 tests" · "sports / coach / form-check"
- ✅ "measures and drafts; the therapist decides and publishes" · "trend evidence" · "adjunct" · "movement digital twin"
- ❌ Any real patient video, name, or record — even blurred from your own testing. Self/consented footage only.
- ❌ A hosted/Supabase screen. The video is the local demo judges will reproduce.

## 7. Recording-Day Checklist

- [ ] Saved biomech result for the hero clip verified (reload is instant)
- [ ] Click-path rehearsed 3× end-to-end (the take you publish is take 3's calm, not take 1's luck)
- [ ] Captions burned in; watched once fully muted (does it still make sense?)
- [ ] Watched once at 1.5× (does the hero morph still land?)
- [ ] Public link verified in a private/incognito window (guide §7: inaccessible video = judging failure)
- [ ] Runtime confirmed ≤ 3:00; file named/labeled with the build window ("Built Oct 27–Nov 4")

*Flow version 1.0 · 2026-11-03 · Supersedes the 7-minute walkthrough in `docs/DEMO.md` for hackathon purposes (that guide remains the hosted-product walkthrough) · Product facts at `e1d8d89`.*
