# Aruga — Demo Video Flow & Highlight Guide (3-Minute Submission Cut)

**Document:** `DEMO_VIDEO_FLOW` · Created 2026-11-03 · **Revised 2026-11-05 — editor-aligned recut of the current 3:37 timeline (v2.1: 5-second landing-page intro, demo-first)**
**Requirement source:** Meta Global AI Developer Hackathon Participant Guide §7 — **3-minute demo video**, a primary judging artifact (Stage Three finalists are re-judged live *on the video*)
**Brand/message source:** [BRAND_AND_MESSAGING_GUIDE.md](BRAND_AND_MESSAGING_GUIDE.md) · **Evidence source:** [RESEARCH_SYNTHESIS.md](../studies/RESEARCH_SYNTHESIS.md) (§9 discipline binding) · **Scoring source:** [HACKATHON_WINNING_CONDITIONS_1103261726.md](../audit/HACKATHON_WINNING_CONDITIONS_1103261726.md)
**Interactive companion:** [DEMO_VIDEO_FLOW.html](DEMO_VIDEO_FLOW.html)

> **The one rule:** record the **judge-local path itself** (unauthenticated playgrounds, your machine, your footage) — the video must show exactly what judges will run. If a shot can't be reproduced by a judge in 10 minutes with only a Meta key, it doesn't go in the video.

> **This revision:** this is a hackathon demo, not a pitch video. The intro is **only the landing page, held 5 seconds** — it identifies the product and gets out of the way. Everything else serves the demo loop already on your timeline: `landing → goals (passing) → dashboard (sped up) → create program → do program → therapist feedback + biomech`. Your 3:37 cut becomes **2:52**; the 7 seconds saved from the old 12s intro are **reinvested in the demo** (Create +2s · Doing +2s · Biomech +3s), not banked.

---

## 1. At a Glance

| Property | Spec |
|---|---|
| Runtime | **3:00 hard cap** (guide §7) — **this recut targets 2:52** (172s), down from your current **3:37 (217s)** |
| Cut required | **−45 seconds**, taken entirely from supporting beats and dead air — never from the core (§3 table) |
| Intro | **Landing page only, 0:00–0:05.** No problem montage, no logo sequence, no team intro. Product identified → demo starts at 0:05 |
| Structure (your editor order, kept) | Landing (5s) → **Goals (passing)** → **Dashboard (sped up)** → **Creating home program ★** → quick goals note → **Doing the home program ★** → **Therapist feedback + Biomech Agent ★★ climax** → Close |
| Core (protected, 136s = 79% of runtime) | Creating home program + Activity Agent (46s) · Doing the home program (37s) · Therapist feedback + Biomechanical Agent (53s) |
| Supporting (compressed, 36s) | Landing page (5s) · Client Goals & Insights (7s, voiceover-in-passing) · Client Dashboard + Aruga AI messaging validation (11s, picture at 1.75–2×) · Quick goals note (5s) · Close (8s) |
| Capture | Screen-record the local app (`/tools/biomech`, `/sam-test`, client dashboard) + 1 phone-shot clip of a real person practicing (consented/self) |
| Fallback rule | Biomech shown from a **pre-run saved result**; live inference is the backup narrative, never the live dependency (Modal CPU 90–130s) |
| Audio | Voiceover recorded separately at normal speed (never speed the voice); captions burned in (judges watch muted) |
| Forbidden frames | Login walls, Supabase dashboards, "93/93", the words *diagnoses/advises/sports/coach/AI therapist* (see §7) |

**Treatment key used below:** `PASSING` = seen, named by voiceover, not dwelt on · `FAST` = sped-up picture under normal voice · `CORE` = full pace, this is the product · `CLIMAX` = built-up payoff, most time + only deliberate silences in the video.

## 2. Shot-by-Shot Flow (172 seconds)

### 2A. 0:00–0:05 — LANDING PAGE · `IDENTIFY ONLY` (5 seconds, hard limit)
- **Show:** the landing page. Static or a slow push-in — nothing else. No home-practice montage, no calendar/caseload visual, no logo animation, no "Hi, we're Team…".
- **Say (VO, one line):** "This is Aruga — home therapy, measured."
- **On-screen text (landing page carries it; add as lower-third if the page doesn't):** `50–65% of home practice goes unobserved [adherence literature]` — judges read it while the VO names the product; do not spend VO time explaining it. The demo itself proves the claim over the next 2:47.
- **Edit note:** at 0:05 you are already in the product. In a hackathon, the demo *is* the pitch — every second before the first real screen is a second a judge spends deciding whether to keep watching.

### 2B. 0:05–0:12 — CLIENT GOALS & INSIGHTS · `PASSING` (7 seconds, do not expand)
- **Show:** your goals/insights footage at **1.5×**, one smooth scroll or a slow push-in on the goal cards. Do not click into anything; do not let the cursor stop.
- **Say (VO, in passing — recorded normal, laid over the sped picture):** "It starts with the client's goals — and insights from how they're already moving."
- **Why this works:** judges need to know goals *exist* and that the program is built from them — they do not need to read a goal card yet. The payoff reading happens at 2:32, when those same goals update. Spending 20–30s here is what pushed you to 3:37; 7s carries the same information.
- **On-screen text (caption, lower third):** `Goals + AI insights — set with the therapist`
- **Don't:** add a second goals explanation later. Goals get exactly two more touches — the 5s note at 1:09 (§2E) and the update at 2:32 (§2G4) — both reuses, no new screen time.

### 2C. 0:12–0:23 — CLIENT DASHBOARD + ARUGA AI MESSAGING VALIDATION · `FAST` (11 seconds)
- **Show:** dashboard footage at **1.75–2× playback**: dashboard lands → highlights/progress visible → Aruga AI message with its validation state visible. End the segment on the validation beat — hold that frame at normal speed for the final 2s so judges can actually read it.
- **Say (VO, normal speed over sped picture):** "On the dashboard, families see progress in plain language — and every Aruga AI message is checked before it reaches them."
- **Pacing rule:** speed the **picture only**. Speeding the voice reads as rushed; speeding the cursor/scroll reads as "this is a tour, the detail lives in the core demo coming next."
- **Highlight:** the validation state is the trust claim of this segment — it must be the one dashboard element shown at 1×. Everything else in this segment is scenery.
- **Don't:** walk the dashboard feature-by-feature. One pass, one claim (validated messaging), out. You're in the core demo by 0:23.

### 2D. 0:23–1:09 — CREATING THE HOME PROGRAM + ACTIVITY AGENT · `CORE ★` (46 seconds)
- **Show (your two existing clips joined):** therapist types shorthand → **Activity Agent** drafts the program → activities, repetitions, and weekly sequence appear → therapist reviews/edits → publish. Join "creating home program" and "creating with Activity Agent" as one continuous build — agent drafting *is* the creation story, not a separate feature.
- **Say (VO):** "Watch a program get built. The therapist types a few words of shorthand — the **Activity Agent** turns it into a structured week: each activity drafted, repetitions set, days sequenced. Built around this client's goals, this client's home, and what they can actually do today — not copied from a generic template. The therapist reviews, edits, and publishes. Nothing reaches the family until the clinician approves it. What used to take an evening of paperwork now takes minutes."
- **Pacing:** full speed, but **jump-cut all dead time** — typing (type 3–4 words, cut to completed text), loading spinners, cursor travel. The agent's drafting reveal plays in real time; everything human around it is compressed.
- **Highlight:** the shorthand → structured-week morph. Hold the completed program 2s before moving on — this is the first "AI did real work" evidence.
- **On-screen text:** `Activity Agent: shorthand → structured week · therapist approves before publish`

### 2E. 1:09–1:14 — QUICK NOTE: PROGRAM ↔ GOALS · `PASSING INSERT` (5 seconds, no new footage)
- **Show:** reuse the goals frame from §2B (freeze or re-crop it) with a highlight/push-in on the goal each activity serves. This is an insert cut over the tail of the program screen — picture-in-picture or a 5s cutaway, whichever your editor already makes easy.
- **Say (VO, single line):** "Every activity maps back to those goals."
- **Why here:** placed *after* creation, this converts goals from an early list into a thread the viewer carries into the climax. It costs 5s, needs no recording, and it pre-loads the 2:32 payoff where the goals visibly update.
- **Don't:** narrate the mapping activity-by-activity. One line, one visual link, cut.

### 2F. 1:14–1:51 — DOING THE HOME PROGRAM · `CORE ★` (37 seconds)
- **Show:** client performing the program at home (phone footage intercut with the in-app guidance view if you have it): guidance on screen → movement → reps/session captured. Use the **two best repetitions**, not the full set.
- **Say (VO):** "Then the client does it at home. Just a phone — where practice already happens. Guidance on screen, the session recorded as they go. No extra hardware. No clinic visit. This is the moment home therapy usually goes dark."
- **Pacing:** normal speed — this is the human beat and the setup for the climax. Real hands/room/sound sell "Demo (25%)" better than any UI shot.
- **Build-up beat (last 5s, important):** freeze or slow the plain replay and let the VO drop out. On-screen text only: `It looks fine. But is it?` — hold 2s in near-silence. This unanswered question is the ramp into §2G; do not answer it here.
- **Don't:** show every rep or the full session timer. Two clean reps + the freeze-frame question is the whole segment.

### 2G. 1:51–2:44 — THERAPIST FEEDBACK + BIOMECHANICAL AGENT · `CLIMAX ★★` (53 seconds — the build-up)
This is where the AI-generated insights land, and it is staged as an escalation: **watching → measuring → insight → decision.** Do not present the biomech output as one flat results screen — reveal it in layers, one insight at a time, with the music/VO rising. The step-by-step build is in §5.

- **2G1 · 1:51–1:59 — Anticipation (8s).** Therapist opens the submitted session; plain replay plays, unmeasured — the same view the freeze-frame left you with.
  - **Say:** "Watching a video isn't measuring it."
  - **Pacing:** let the plain replay breathe 3–4s before the line. The flatness is deliberate — it makes the reveal feel earned.
- **2G2 · 1:59–2:14 — The reveal (15s).** Biomech result opens (saved result, instant): SAM overlay blooms onto the movement → angle cards appear. **Hold the plain→overlay→numbers morph a full 3 seconds in silence** (music only, VO out).
  - **Say (after the hold):** "So the **Biomechanical Agent** measures it. Meta **SAM 3.1** tracks the movement; **SAM 3D Body** turns it into joint angles and range of motion."
  - **On-screen text:** `SAM 3.1 → SAM 3D Body → angles / ROM / flags`
- **2G3 · 2:14–2:32 — Insights stack (18s).** Insight cards/flags resolve **one at a time** (edit your results screen into a sequence if it renders at once: crop/zoom per insight, ~3–4s each). Order: (1) joint angle now, (2) change vs. last session, (3) compensation flag, (4) plain-language implication. The extra seconds from the intro cut go here — insights get reading time, not narration speed.
  - **Say:** "Now the insights build. The shoulder is opening further than last week. The trunk is compensating. The trend is real — and it's written from this session's numbers, not a template." *(Adapt the joint/trunk nouns to what your actual clip measures.)*
  - **Highlight:** a visible delta (`142° → 158°`) is personalization judges can *see*. Keep each insight on screen ≥2s — muted judges must be able to read the top two from captions alone.
- **2G4 · 2:32–2:44 — Therapist decides (12s).** Agent-drafted feedback appears → therapist edits a word/line → publishes → family view receives it → the goals strip updates against the new evidence (the §2B/§2E thread pays off).
  - **Say:** "The agent drafts the feedback. The **therapist edits, decides, and publishes it.** The family gets the next step — and the goals update with the evidence."
  - **Discipline:** the agent *drafts and measures*; the publish click belongs to the therapist, on camera. That single click is your safety story — do not cut it for time.

### 2H. 2:44–2:52 — CLOSE (8 seconds)
- **Show:** product frame → end card. SPOTx 2016 lineage and pricing move to **on-screen text** (they were VO in v1; the recut spends VO only on the core loop).
- **Say (VO, final line only):** "Aruga. Measured at home. Decided by therapists. **Care that continues.**"
- **On-screen text (hold to end):** `Designed 2016, Philippines (SPOTx) · Built with Meta SAM 3.1 + SAM 3D Body · $49/intensive patient · Repo: <URL> · Built Oct 27–Nov 4, 2026`
- **Don't:** end on the dashboard or a feature list. The last spoken words are the brand line; the last frame is lineage + repo.

## 3. Where the 45 Seconds Come From (3:37 → 2:52)

| Edit action | Where | Saves |
|---|---|---:|
| Intro: problem montage → **landing page only, 5s** (§2A) | Head of timeline | −7s vs. v2.0 draft |
| Goals & Insights: full dwell → 7s passing scroll at 1.5× (§2B) | Early goals footage | −12s |
| Dashboard + messaging: feature walk → single pass at 1.75–2×, only validation held at 1× (§2C) | Dashboard footage | −13s |
| Program creation: jump-cut typing, loading, cursor travel; keep only the agent reveal at real time (§2D) | Creation footage | −8s |
| Doing the program: full set → two best reps + freeze-frame (§2F) | Client footage | −6s |
| Closing frames trimmed; lineage/pricing become on-screen text (§2H) | Tail | −6s |
| **Total** | | **−45s → 2:52** |

**Reinvestment rule:** the 7s freed by the 5s intro are spent *inside the demo* — Create 44→46s, Doing 35→37s, Biomech 50→53s (the extra biomech seconds buy insight reading time in §2G3). Runtime stays 2:52; demo share rises to 79%. If you later need to go shorter, cut §2B/§2C further — never §2D, §2F, or §2G.

## 4. Full Voiceover Script (record as one take sheet)

≈ **260 words ≈ 1:55 of speech inside a 2:52 video** — the other ~55s is deliberate: the sped-up tours, the morph hold, and the biomech build. Do not fill those gaps; the silences are the pacing. `[brackets]` are delivery cues, not spoken.

> **[one line, then get out of the way]** This is Aruga — home therapy, measured. *(0:00)*
>
> **[lighter, in passing]** It starts with the client's goals — and insights from how they're already moving. *(0:05)*
>
> **[brisk]** On the dashboard, families see progress in plain language — and every Aruga AI message is checked before it reaches them. *(0:12)*
>
> **[settle in — this is the demo]** Watch a program get built. The therapist types a few words of shorthand — the Activity Agent turns it into a structured week: each activity drafted, repetitions set, days sequenced. Built around this client's goals, this client's home, and what they can actually do today — not copied from a generic template. The therapist reviews, edits, and publishes. Nothing reaches the family until the clinician approves it. What used to take an evening of paperwork now takes minutes. *(0:23)*
>
> **[single line, warm]** Every activity maps back to those goals. *(1:09)*
>
> **[warm, slower]** Then the client does it at home. Just a phone — where practice already happens. Guidance on screen, the session recorded as they go. No extra hardware. No clinic visit. This is the moment home therapy usually goes dark. *(1:14)* — **[VO out; caption only: "It looks fine. But is it?"]**
>
> **[quiet]** Watching a video isn't measuring it. *(1:51)* — **[3s silence over the overlay morph; music only]**
>
> **[building]** So the Biomechanical Agent measures it. Meta SAM 3.1 tracks the movement; SAM 3D Body turns it into joint angles and range of motion. Now the insights build. The shoulder is opening further than last week. The trunk is compensating. The trend is real — and it's written from this session's numbers, not a template. *(1:59)*
>
> **[resolve]** The agent drafts the feedback. The therapist edits, decides, and publishes it. The family gets the next step — and the goals update with the evidence. *(2:32)*
>
> **[final, unhurried]** Aruga. Measured at home. Decided by therapists. Care that continues. *(2:44)*

**Recording notes:** record each timestamped block as a separate clip so you can re-time without re-recording; leave 0.5s of room tone at each block head/tail; emphasize only the bolded phrases — if everything is emphasized, the biomech reveal won't stand out.

## 5. Building Up the AI Insights (the biomech crescendo)

The difference between "we show biomech results" and a climax is **sequencing**. Edit §2G as four escalating questions, each answered by the next layer:

| Step | Viewer question | Layer revealed | Sound/VO behavior |
|---|---|---|---|
| 1 · Anticipation (1:51) | "Can anyone tell what happened here?" | Plain replay, no overlay — deliberately flat | Room tone; one quiet line; music low |
| 2 · Reveal (1:59) | "Now it's being measured" | SAM overlay bloom → joint angle cards | **VO silent 3s**, music lifts; then name SAM 3.1 + SAM 3D Body *as they appear* |
| 3 · Insights (2:14) | "So what does it mean?" | One insight at a time: angle → delta vs. last session → compensation flag → plain-language line | VO reads only the top 2–3 insights; captions carry the rest for muted judges |
| 4 · Decision (2:32) | "Who acts on this?" | Agent draft → therapist edit → **publish click** → goals update | VO resolves; music settles; end on the publish, not the chart |

- **Never** show the full results grid in one frame as the first biomech shot — a wall of numbers reads as a dashboard, not an insight. The grid may appear for 2s at the end of 2G3 as the "and there's more" beat.
- **Music:** one track, two moves only — lift under the 1:59 morph, settle under the 2:32 publish. No other music edits; constant re-scoring flattens the build.
- **Captions carry numbers:** every angle/delta spoken in VO also appears as burned-in text at the moment it's said (muted autoplay is the default judging environment).
- **Fallback honesty:** if the saved-result reload has any visible seam, say "saved once, reopens free" over it — it converts a shortcut into the cost-discipline story. Never fake a live-run progress bar.

## 6. What to Highlight — Checklist by Judging Category

| Category (weight) | Highlight in video | Where |
|---|---|---|
| **Impact (30%)** | Literature number (50–65%) as landing-page text in the first 5s, home-practice-made-visible story, family-readable validated messaging, lineage card | 0:00, 0:12, 2:44 |
| **Meta Tooling (25%)** | SAM 3.1 + SAM 3D Body named *at the morph*, Activity Agent drafting on screen — name each model/agent as it appears | 0:23, 1:59 |
| **Technical (20%)** | Agent shorthand→week morph with dead time cut (speed is the claim), saved-result instant reload, goals updating from new evidence | 0:23, 1:59, 2:32 |
| **Demo (25%)** | The demo starts at 0:05 and never really stops: your actual editor footage/judge-local path throughout, real home-practice footage, therapist publish click, zero login walls | 0:05–2:44, esp. 1:14, 2:32 |

## 7. Production & Editor Spec

- **Timeline actions (in order):** (1) replace the intro with the landing page, **hard 5s**; (2) apply §3 trims; (3) set §2B to 1.5× and §2C to 1.75–2× (picture only); (4) insert §2E goals reuse; (5) freeze-frame + caption at end of §2F; (6) re-sequence §2G into the 4 layers of §5; (7) lay VO blocks (§4) and duck music under 1:59/2:32; (8) burn captions, check runtime ≤2:55.
- **Prep:** biomech result for the doing-the-program clip pre-run and saved (reload is the on-camera path); browser cleared of dev clutter; sample data self/consented only.
- **Clip choice:** ≤15s, single person, full limb in frame, good light (bad framing suppresses measurement *on camera*).
- **Recording:** 1080p screen capture, system audio off, VO after; keep the product's own dark UI as the grade.
- **Takes:** the calm, rehearsed take is the publish take — assemble, don't hero-edit the climax; its pauses are timed, not accidental.

## 8. Derivative Cuts (make these from the master, free)

| Cut | Length | Source segment | Use |
|---|---|---|---|
| Viral cut | 0:30 | Biomech build-up 1:59–2:32 (reveal → insights) | X post for Most Viral ($20k, engagement to Nov 8 EOD) |
| Gallery loop | 0:15 silent | Overlay morph + first insight (1:59) | Community-vote gallery card (muted autoplay) |
| Core-loop cut | 0:60 | Create → do → measure (0:23–1:09 + 1:51–2:14 compressed) | Submission-text / follow-up demo link |

## 9. Do-Not-Say / Do-Not-Show (claim discipline, RESEARCH_SYNTHESIS §9)

- ❌ "AI diagnoses / advises / treats" · "AI therapist" · "clinical-grade angles" · "replaces therapy" · "93/93 tests" · "sports / coach / form-check"
- ✅ "measures and drafts; the therapist decides and publishes" · "trend evidence" · "adjunct" · "movement digital twin"
- ❌ Any real patient video, name, or record — even blurred from your own testing. Self/consented footage only.
- ❌ A hosted/Supabase screen. The video is the local demo judges will reproduce.
- ❌ A long intro. The landing page is 5 seconds; anything past that before the demo starts is pitch, and this is a hackathon.
- ❌ Wall-to-wall narration over the biomech reveal — the 3s silent hold at 1:59 is load-bearing; do not "fix" it in the edit.

## 10. Editor Checklist

- [ ] Runtime after trims ≤ 2:55 (target 2:52); confirmed on the exported file, not the timeline estimate
- [ ] **Intro = landing page only, ≤5s**; demo (goals screen) starts at 0:05; no montage/logo/team intro
- [ ] Goals segment is 7s at 1.5× with in-passing VO — no click-ins, no cursor stops (§2B)
- [ ] Dashboard at 1.75–2× with **only** the messaging-validation frame held at 1× (§2C)
- [ ] Activity Agent creation joined as one segment; typing/loading jump-cut; publish/approve visible (§2D)
- [ ] 5s goals quick-note inserted immediately after program creation (§2E)
- [ ] Doing-the-program cut to two best reps + freeze-frame "It looks fine. But is it?" (§2F)
- [ ] Biomech revealed in 4 layers (plain → overlay → insights one-by-one → publish); 3s silent morph hold intact (§2G/§5)
- [ ] Therapist's publish click visible and uncut; goals update shown after it (§2G4)
- [ ] VO recorded per §4 blocks (~260 words); voice never speed-ramped; captions burned in
- [ ] Watched once fully muted (insights still readable?) and once at 1.5× (morph still lands?)
- [ ] Saved biomech result verified (instant reload); self/consented footage only; no forbidden language
- [ ] Public link verified in a private/incognito window (guide §7: inaccessible video = judging failure)
- [ ] End card: lineage + pricing + repo URL + "Built Oct 27–Nov 4, 2026"

*Flow version 2.1 · 2026-11-05 · Editor-aligned recut with 5s landing-page intro: compresses Intro/Goals (passing) and Dashboard (sped up) to protect the create → do → measure/decide core and the biomech climax · Supersedes v2.0/v1.0 for the current timeline; `docs/DEMO.md` remains the hosted-product walkthrough · Product facts at `e1d8d89`.*
