# Aruga — Brand & Messaging Guide

**Document:** `BRAND_AND_MESSAGING_GUIDE` · Created 2026-11-03
**Evidence base:** [RESEARCH_SYNTHESIS.md](../studies/RESEARCH_SYNTHESIS.md) — claim discipline in its §9 is binding on every line of copy in this guide
**Companions:** [HACKATHON_WINNING_CONDITIONS_1103261848.md](../audit/HACKATHON_WINNING_CONDITIONS_1103261848.md) · [BUSINESS_MODEL_CANVAS_V5_1103261642.md](../audit/BUSINESS_MODEL_CANVAS_V5_1103261642.md)
**Interactive companion:** [BRAND_AND_MESSAGING_GUIDE.html](BRAND_AND_MESSAGING_GUIDE.html)

> **How to use this guide.** §1–§2 are the brand. §3 is the messaging architecture — five themes, each with a definition, proof, and permitted language. §4 is the **Top 5 Features to Feature** (the only features marketing should lead with). §5–§7 are copy blocks you can paste. §8 is the do-not-say list; violating it risks clinician credibility and, at the hackathon, the medical-advice anti-pattern. When in doubt: *the therapist is the hero, the AI is the instrument.*

---

## 1. Brand Essence

| Element | Definition |
|---|---|
| **Name story** | *Aruga* (Filipino: to take care of, to nurture) — care that continues beyond the clinic walls. Say this once, early; it roots the brand in the SPOTx/Philippine lineage (research F3) without exoticizing it |
| **Category** | Clinician-directed home-program companion (PT / OT / SLP) — *not* "AI therapy," *not* a telehealth video platform |
| **Brand idea** | **Care that continues.** Therapy doesn't end at the clinic door; Aruga makes the home half of rehabilitation visible, measurable, and personal |
| **Personality** | Clinical warmth. Precise like an instrument, kind like a caregiver. Dark-zinc seriousness, teal signal, crayon humanity (illustrated worksheets) — the product already looks like this; the words must match |
| **The enemy** | The invisible home program: unobserved practice that silently fails 50–65% of the time (F2), reviewed through Messenger threads (F7), in systems with 2.5 therapists per 100,000 people (F3) |
| **The hero** | The licensed therapist. Aruga never "treats," "diagnoses," or "advises" — it *measures, drafts, and organizes* so the therapist's judgment reaches further |

**Tagline system (pick one primary, keep the rest as campaign lines):**
- Primary: **"Care that continues."** (brand-level; pairs with the name story)
- Product: **"Home practice, measured."** (the measurement claim, F4)
- Campaign/demo: **"Every session re-judged. Every story personal."** (the hyperpersonalization claim, §3.4)

## 2. Audiences & Their One Sentence

| Audience | What they fear | The sentence that lands |
|---|---|---|
| **Therapist** (primary user) | Drowning in unobserved caseloads and after-hours documentation | "Review a week of home practice in minutes — with angles, not just video." |
| **Clinic owner / manager** | Therapist scarcity capping revenue; procurement/compliance risk | "Your therapists supervise more patients, asynchronously, with an audit trail." |
| **Patient / family** | Doing exercises wrong, alone, forgotten between visits | "Your therapist sees every practice — and your progress story is written from your own movement." |
| **Hackathon judge / investor** | Another wrapper demo | "A decade-old clinical problem (SPOTx, 2016) finally solvable: agentic measurement of home rehabilitation, built on Meta's full model stack." |
| **Procurement / compliance** | PHI exposure, AI overreach | "Clinician-directed, ownership-gated, audit-logged — AI drafts, humans publish." |

## 3. Messaging Architecture — The Five Themes

Every external claim must hang from one of these five pillars. Each has: a plain definition, the research proof, the product proof, and the exact language discipline.

### 3.1 AGENTIC — *"Agents that prepare evidence, not opinions that replace clinicians"*

- **Meaning:** Aruga runs bounded AI agents — Activity, Biomech Planner, Goal Tracking, Highlights — that execute multi-step clinical-prep work (plan → segment → measure → validate → narrate) with persisted traces a therapist can inspect, then publish or discard.
- **Proof:** 4 agents at `e1d8d89` (`goal-agent.ts` 7-signal verdicts with agent traces; `highlights-agent.ts`; biomech planner over a locked 16-keyword vocabulary; activity agent Spark→Image). Research: verifiable-agent patterns; F6 (draft-review is the validated AI pattern).
- **Say:** "agentic workflow," "agents prepare, therapists publish," "inspectable traces." **Never:** "autonomous treatment," "AI therapist," "the agent decides."

### 3.2 SIMULATION — *"Replay the movement. Rehearse the recovery."*

- **Meaning:** Every recorded practice becomes a replayable simulation of the patient's movement — SAM overlays synced to the scrub bar, a 3D dot-body replay (Motion3DDots), and view-switchable biomech intents (U1–U11) re-filtered from one capture without re-recording or re-billing. The therapist studies the movement the way engineers study a simulation: pause, rewind, change the lens.
- **Proof:** `BiomechOverlay`, `Motion3DDots`, one-capture/multi-view design (switching views reuses the same Modal result). Research: Zhang 2007's 3D-animation telerehab ancestor (L4.3) — Aruga is that idea at smartphone scale.
- **Say:** "movement replay," "simulate the session from any angle of analysis," "one capture, every view." **Never:** "virtual reality therapy," "digital patient simulation" (it simulates *recorded movement*, not a synthetic patient).

### 3.3 DIGITAL TWINS — *"A movement twin that grows with every practice"*

- **Meaning (use this definition verbatim):** each patient accumulates a **movement digital twin** — the evolving computational record of how *their* body moves: per-frame 3D keypoints, joint-angle trajectories, ROM trends, compensation flags, indexed by session and goal. Every submission updates the twin; every goal verdict is read *from* the twin. It is explicitly a **kinematic twin, not a physiological or diagnostic twin.**
- **Proof:** SAM 3D Body per-frame 3D + slim/artifact persistence (`biomech_jobs` + Storage) means the twin is queryable history, not a one-off report; trend deltas ("142° → 158°") are twin diffs. Research: F4 accuracy bands (3.85° MAE healthy / 6.1° patient RMSE) define the twin's honesty envelope.
- **Say:** "movement digital twin," "your twin remembers every session." **Never:** bare "digital twin of the patient" without *movement/kinematic* — overclaiming invites the diagnostic-accuracy rebuttal.

### 3.4 HYPERPERSONALIZATION — *"No two patients get the same judgment"*

- **Meaning:** goals are dynamically re-validated after every session; insights and monthly Highlights are synthesized from the individual's own longitudinal twin — their angles, their adherence rhythm, their goals — in their family's language. Personalization of *judgment*, not just content (full treatment: RESEARCH_SYNTHESIS §14/M7).
- **Proof:** dynamic goal validation (`on_track/at_risk/behind/achieved/gap` per submission), per-patient best-7 Highlights, per-user cached family summaries. Research: F2 (individualized programs still failed 50.8% without feedback — personalization *plus loop-closure* is the intervention), F5.
- **Say:** "re-judged after every session," "written from your own data," "your month, your numbers." **Never:** "AI knows what's best for you" — the therapist validates; the system personalizes.

### 3.5 ASYNC TELEREHAB — *"Care that doesn't need both of you awake"*

- **Meaning:** the entire clinical loop — prescribe → practice → measure → validate → feedback → family story — is store-and-forward. No appointments for supervision, no live video, no wearables. Built for the arithmetic of scarcity: one therapist, many homes, zero schedule collisions.
- **Proof:** the shipped submission/review architecture; telephone-grade ancestry (Odole 2014: telephone PT matched clinic QoL). Research: F1 (cost-effective, LMIC-recommended), F3 (2.5 PT/100k — synchronous care cannot scale there), SPOTx's founding constraint.
- **Say:** "asynchronous by design," "supervision without scheduling," "works on yesterday's mid-range phone." **Never:** position against live care — Aruga is the *adjunct* that makes live sessions count (F1 hybrid evidence).

## 4. Top 5 Features to Feature (the only lead features)

Ranked by: judge stopping-power × evidence strength × uniqueness. Everything else is supporting cast — mention, never lead.

| # | Feature (lead name) | Theme(s) | The one-line claim | Demo moment (what they see) | Proof on file |
|---|---|---|---|---|---|
| **1** | **Movement Digital Twin (Biomech Engine)** | Digital Twins · Simulation | "One phone video becomes your patient's measured movement twin — joint angles, ROM, flags." | Upload clip → SAM tracks → twin replay with angle cards updating | SAM 3.1 → Modal SAM 3D Body (`modal/app.py`); OpenCap accuracy context [E7] |
| **2** | **Dynamic Goal Validation Agent** | Agentic · Hyperpersonalization | "Every goal, re-judged after every session — on track, at risk, or achieved, with the evidence attached." | Open a goal → verdict flips with the latest submission; trace expands to show the 7 signals | `goal-agent.ts`; F2 adherence literature |
| **3** | **Hyperpersonal Highlights & Insights** | Hyperpersonalization · Agentic | "Your month, written from your own movement — seven highlights, your numbers, words your family understands." | Client dashboard: Highlights strip + plain-English summary renders instantly (cached) | `highlights-agent.ts`; F5 engagement reviews |
| **4** | **Simulation Replay (One Capture, Every View)** | Simulation | "Pause, rewind, re-lens the movement — U-views re-filtered from a single capture, no re-recording, no re-billing." | Scrub the video: overlay + 3D dots stay synced; switch U1→U5, results re-filter live | `BiomechOverlay` + `Motion3DDots`; Zhang 2007 lineage |
| **5** | **Async Telerehab Loop (with Agentic Worksheets)** | Async Telerehab · Agentic | "Prescribe in shorthand, get illustrated worksheets drawn for that one patient — practice, review, and feedback with nobody scheduling anything." | Type rough instructions → program drafted → Muse Image worksheet appears → client practices against it | Spark draft + Muse Image two-stage; Odole 2014 async ancestry |

**Feature discipline:** Feature 1 is the hero (open the demo with it), 2–3 are the retention story, 4 is the "wow, rewind that" moment, 5 is the workflow close. The OT/Aruga Guide chat, messaging, and SOAP drafting are *supporting* — they prove completeness, they don't headline (chat-first framing invites the "simple chatbot" anti-pattern comparison).

## 5. Copy Blocks (paste-ready)

**10 seconds (X / gallery):** "Therapists can't see home practice, so 50–65% of it silently fails. Aruga turns the patient's own phone video into a measured movement twin — goals re-judged after every session, progress families can read. The therapist always decides."

**30 seconds (video open/close):** "In 2016 we designed SPOTx because Philippine therapists were losing patients between sessions. The problem was never effort — home practice is invisible, and invisible practice fails. Aruga makes it visible: SAM 3.1 and a 3D body model measure every recorded session, agents re-validate every goal, and each family's progress story is written from their own movement. Asynchronous, phone-first, clinician-directed. Care that continues."

**Boilerplate (submission form / press):** "Aruga is a clinician-directed home-program companion for physical, occupational, and speech therapy. Patients record prescribed practice on any phone; Meta SAM 3.1 segments the movement and a SAM 3D Body stage (Modal) computes joint angles, range of motion, and compensation flags — forming a per-patient movement digital twin. Spark-powered agents dynamically validate therapy goals after every session and compose hyperpersonalized monthly highlights and plain-English summaries for families. Therapists review and publish everything; nothing reaches a patient unreviewed. Built on telerehabilitation evidence spanning a 69-paper corpus and the founder's 2016 SPOTx capstone, Aruga is asynchronous by design for the clinics — from Manila to Mindanao — with the fewest therapists to spare."

**Objection responses:**
- *"Isn't this AI medical advice?"* → "No. Aruga measures and drafts; licensed therapists decide and publish. That boundary is architectural — and it's the pattern the telerehab evidence validates."
- *"How accurate are the angles?"* → "Trend-grade and honest about it: smartphone markerless measurement validates at roughly ±4–6° in the literature, we show bands not false precision, suppress bad captures, and the therapist verifies before anything is used."
- *"Why not just use WhatsApp / an exercise app?"* → "WhatsApp is where the records — and the privacy — go to die; exercise apps end at prescription. The failure is unobserved practice, and that's the loop Aruga closes."

## 6. Voice & Lexicon

**Voice:** measured warmth — numbers first, kindness always; short sentences for families, precise sentences for clinicians; Filipino-rooted, globally fluent.

| ✅ Say | ❌ Never say | Why |
|---|---|---|
| clinician-directed · therapist-reviewed | AI therapist · AI advises · diagnoses | Claim discipline §9 + hackathon anti-pattern |
| movement digital twin (kinematic) | digital twin of the patient | Accuracy honesty (F4) |
| trend evidence · measured | clinical-grade · proven outcomes (for Aruga) | Aruga has no outcomes trial yet |
| home practice · home program | homework · compliance (about patients) | "Adherence" for data, "practice" for people |
| family-readable · plain words | dumbed-down · simplified for laymen | Respect for the reader |
| asynchronous · store-and-forward | offline · delayed care | Async is a design virtue, not a deficit |
| prepares evidence | replaces judgment · automates therapy | The therapist is the hero |

## 7. Visual Identity (as shipped — codify, don't redesign)

Dark clinical system: zinc `#09090b`/`#121215` surfaces, teal `#14b8a6` as the signal color (measurement/telemetry), amber `#f59e0b` for watch-states, sky `#0284c7` for information; Inter for UI, JetBrains Mono for numbers/data, Playwrite wordmark for humanity. Crayon-style illustrated worksheets (pegs) are the warmth counterweight — keep human illustration wherever the system shows measurement, so the brand never reads as surveillance. Photography/video: real hands, real homes, one phone on a table — never stock clinic sterility, never a headset.

## 8. Channel Notes

- **Demo video (3 min):** Feature order 1→4→2→3→5 per §4; SPOTx screenshot once at the lineage beat; literature number in the first 25s; the production-vs-demo sentence on the record.
- **X / viral:** lead with the twin replay clip (simulation is the thumb-stopper); caption = 10-second block; hashtag discipline: category tags only, no medical claims.
- **Gallery/community:** thumbnail = biomech overlay frame (the twin made visible); title leads with "Movement Digital Twin for Home Rehab," not the brand name alone.
- **README:** first screen = quantified problem (F2) → five-theme strip (§3) → Top 5 features (§4) → judge quickstart. Research links one click down (`RESEARCH_SYNTHESIS.html`).

*Guide version 1.0 · 2026-11-03 · Evidence: `studies/RESEARCH_SYNTHESIS.md` (§9 discipline binding) · Product facts at `e1d8d89` — re-verify feature claims against the tree before each external use.*
