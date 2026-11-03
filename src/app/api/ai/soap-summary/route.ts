import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMetaOpenAiClient, getMetaConfig } from "@/lib/meta/client";

export const maxDuration = 60;
import { deidentifyClinicalText } from "@/lib/hipaa/de-identify";
import { logAuditEvent } from "@/lib/hipaa/audit";

interface SoapSummaryPayload {
  targetType?: "soap_note" | "submission_review";
  targetId?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  clientName?: string;
  forceRegenerate?: boolean;
  overallFeedback?: string;
  stepReviewsText?: string;
  biomechSummary?: string;
  mode?: "soap_plain" | "overall_feedback";
}

function cleanText(txt?: string | null): string {
  if (!txt) return "";
  return txt.trim();
}

/**
 * High-quality clinical plain-language synthesizer.
 * Used when AI endpoint is disabled, offline, or fallback mode,
 * ensuring reliable, instant translation of clinical jargon into patient-friendly takeaways.
 */
function synthesizeOverallFeedbackSummary(params: {
  overallFeedback?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  stepReviewsText?: string;
  biomechSummary?: string;
  clientName?: string;
}): string {
  const nameGreeting = params.clientName ? `${params.clientName.split(" ")[0]}, ` : "";
  const verbatim = cleanText(params.overallFeedback);
  const o = cleanText(params.objective);
  const a = cleanText(params.assessment);
  const bio = cleanText(params.biomechSummary);
  const stepText = cleanText(params.stepReviewsText);
  const p = cleanText(params.plan);

  // Fallback when AI is unavailable — informational but still plain
  let para1 = `${nameGreeting}you did a great job in this session. `;
  if (bio) {
    para1 += `Your video movement analysis showed: ${bio.slice(0, 240)}. `;
  } else if (o) {
    const first = o.split(".")[0].slice(0, 150);
    para1 += `In your performance, ${first.toLowerCase()}. `;
  }
  if (a) {
    const firstA = a.split(".")[0].slice(0, 130);
    para1 += `${firstA}. `;
  }
  let para2 = "";
  if (stepText) {
    const firstStep = stepText.split("\n")[0].slice(0, 150);
    para2 += `Your therapist’s step guidance: ${firstStep}. `;
  }
  if (p) {
    const firstPlan = p.split(".")[0].slice(0, 140);
    para2 += `What to keep practicing: ${firstPlan.toLowerCase()}. `;
  } else {
    para2 += `Keep practicing gently and let your therapist know if anything feels strained. `;
  }
  let out = `${para1.trim()}\n\n${para2.trim()}`;
  if (verbatim) out += `\n\nYour therapist wrote: “${verbatim.slice(0, 180).replace(/\n/g, " ")}”`;
  return out.trim();
}

function synthesizePlainLanguageSummary(params: {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  clientName?: string;
}): string {
  const { subjective, objective, assessment, plan, clientName } = params;
  const nameGreeting = clientName ? `${clientName.split(" ")[0]}, ` : "";

  const s = cleanText(subjective);
  const o = cleanText(objective);
  const a = cleanText(assessment);
  const p = cleanText(plan);

  // Extract key motor progress markers
  let progressHighlight = "You showed great effort and control throughout your exercises.";
  if (o.toLowerCase().includes("wrist") || o.toLowerCase().includes("cup") || o.toLowerCase().includes("grasp")) {
    progressHighlight = "Your hand and wrist control were strong and steady, showing noticeable improvement during grasp and release tasks.";
  } else if (o.toLowerCase().includes("pincer") || o.toLowerCase().includes("peg") || o.toLowerCase().includes("finger")) {
    progressHighlight = "Your finger coordination and pinch grasp showed wonderful progress with much more isolated control.";
  } else if (o.toLowerCase().includes("supination") || o.toLowerCase().includes("forearm")) {
    progressHighlight = "Your forearm rotation and palm-up movements are becoming smoother and more natural.";
  } else if (o.length > 20) {
    // Simplify first sentence of objective
    const firstSentence = o.split(".")[0];
    progressHighlight = `In your performance: ${firstSentence.toLowerCase()}.`;
  }

  // Extract key assessment/safety takeaways
  let safetyOrFatigueNote = "";
  if (s.toLowerCase().includes("fatigue") || s.toLowerCase().includes("rest") || p.toLowerCase().includes("rest")) {
    safetyOrFatigueNote = " Listening to your body and taking breaks when fatigued is exactly what helps muscles recover safely without strain.";
  } else if (a.toLowerCase().includes("progress") || a.toLowerCase().includes("recovery")) {
    safetyOrFatigueNote = " Your functional endurance is advancing right on schedule.";
  }

  // Extract plan takeaway
  let planNote = " Keep up your daily home program, and we will build on this foundation in our next session!";
  if (p.toLowerCase().includes("posture") || p.toLowerCase().includes("table")) {
    planNote = " Remember to keep your chair close to the table and your shoulders relaxed during practice.";
  } else if (p.toLowerCase().includes("warm")) {
    planNote = " Try a warm compress before your stretches if your muscles feel stiff in the morning.";
  } else if (p.toLowerCase().includes("play") || p.toLowerCase().includes("helper hand")) {
    planNote = " Keep encouraging that helper hand during play!";
  }

  return `${nameGreeting}${progressHighlight}${safetyOrFatigueNote}${planNote}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetType = (searchParams.get("targetType") || "soap_note") as "soap_note" | "submission_review";
    const targetId = searchParams.get("targetId");

    if (!targetId) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Service unavailable: database not configured" }, { status: 503 });
    }

    if (targetType === "soap_note") {
      const { data, error } = await admin
        .from("soap_notes")
        .select("id, client_summary")
        .eq("id", targetId)
        .maybeSingle();

      if (!error && data?.client_summary) {
        return NextResponse.json({
          summary: data.client_summary,
          cached: true,
          source: "database_cache",
        });
      }
    } else {
      const { data, error } = await admin
        .from("submission_reviews")
        .select("id, client_summary")
        .or(`id.eq.${targetId},submission_id.eq.${targetId}`)
        .maybeSingle();

      if (!error && data?.client_summary) {
        return NextResponse.json({
          summary: data.client_summary,
          cached: true,
          source: "database_cache",
        });
      }
    }

    return NextResponse.json({
      summary: null,
      cached: false,
      message: "Summary not yet generated or cached in database.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: SoapSummaryPayload = await req.json();
    const {
      targetType = "soap_note",
      targetId,
      subjective = "",
      objective = "",
      assessment = "",
      plan = "",
      clientName = "",
      forceRegenerate = false,
      overallFeedback = "",
      stepReviewsText = "",
      biomechSummary = "",
      mode = "soap_plain",
    } = body;

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Service unavailable: database not configured" }, { status: 503 });
    }

    // STEP 1: Check Database Cache First (Zero AI credits!)
    if (!forceRegenerate && targetId) {
      if (targetType === "soap_note") {
        const { data, error } = await admin
          .from("soap_notes")
          .select("id, client_summary")
          .eq("id", targetId)
          .maybeSingle();

        if (!error && data?.client_summary && data.client_summary.trim().length > 0) {
          return NextResponse.json({
            summary: data.client_summary,
            cached: true,
            source: "database_cache",
            message: "Loaded directly from database cache. Zero AI credits consumed.",
          });
        }
      } else {
        const { data, error } = await admin
          .from("submission_reviews")
          .select("id, client_summary")
          .or(`id.eq.${targetId},submission_id.eq.${targetId}`)
          .maybeSingle();

        if (!error && data?.client_summary && data.client_summary.trim().length > 0) {
          return NextResponse.json({
            summary: data.client_summary,
            cached: true,
            source: "database_cache",
            message: "Loaded directly from database cache. Zero AI credits consumed.",
          });
        }
      }
    }

    // STEP 2: Generate Plain-English Summary
    let generatedSummary = "";

    const { aiMode, apiKey, models } = getMetaConfig();
    const hasLiveAi = aiMode !== "off" && Boolean(apiKey);

    if (hasLiveAi) {
      try {
        const client = createMetaOpenAiClient();

        const safeSubjective = deidentifyClinicalText(subjective || "", { clientName });
        const safeObjective = deidentifyClinicalText(objective || "", { clientName });
        const safeAssessment = deidentifyClinicalText(assessment || "", { clientName });
        const safePlan = deidentifyClinicalText(plan || "", { clientName });
        const safeOverall = deidentifyClinicalText(overallFeedback || "", { clientName });
        const safeStep = deidentifyClinicalText(stepReviewsText || "", { clientName });
        const safeBio = deidentifyClinicalText(biomechSummary || "", { clientName });

        if (mode === "overall_feedback") {
          const response = await client.chat.completions.create({
            model: models.spark,
            messages: [
              {
                role: "system",
                content:
                  "You are an empathetic Occupational Therapist writing to a patient and family at a 6th-grade reading level. Using ONLY the provided data (clinician's verbatim overall feedback, SOAP notes, step-by-step therapist guidance, and optional video movement analysis + worksheet completion), write an informational but easy-to-understand summary. Structure it as 2 short paragraphs (4-6 sentences total): 1) What you did well and what the video/movement analysis showed, 2) What to keep practicing and any simple caution. Use plain words, no jargon. Be specific where data gives numbers (e.g., shoulder lift, wrist control) but explain them simply. Warm and encouraging. Do not invent facts not in the input. If overall feedback is provided, close with a new line: Your therapist wrote: \"[verbatim, 1 sentence trimmed]\".",
              },
              {
                role: "user",
                content: `Overall feedback (verbatim, de-identified): ${safeOverall}\nSOAP — Subjective: ${safeSubjective}\nObjective: ${safeObjective}\nAssessment: ${safeAssessment}\nPlan: ${safePlan}\nStep-by-step therapist guidance: ${safeStep}\nVideo movement analysis / worksheet completion (if any): ${safeBio}\n\nWrite the informational, easy-to-understand session summary (4-6 sentences, plain English, with verbatim quote at end if provided):`,
              },
            ],
            temperature: 0.35,
            max_tokens: 550,
          });
          const text = response.choices[0]?.message?.content;
          if (text && text.trim().length > 0) generatedSummary = text.trim();
        } else {
          const response = await client.chat.completions.create({
            model: models.spark,
            messages: [
              {
                role: "system",
                content:
                  "You are an empathetic Occupational Therapist communicating directly with a patient and their family. Convert the provided clinical SOAP notes into a simple, 2-3 sentence summary in plain, easy-to-understand language. Focus on what improved, celebrate their dedication, and clearly explain what to practice or remember next. Do not use confusing clinical jargon.",
              },
              {
                role: "user",
                content: `Client: Client\n\nClinical SOAP Notes (De-Identified):\n- Subjective: ${safeSubjective}\n- Objective: ${safeObjective}\n- Assessment: ${safeAssessment}\n- Plan: ${safePlan}\n\nGenerate the plain-English summary:`,
              },
            ],
            temperature: 0.3,
            max_tokens: 300,
          });
          const text = response.choices[0]?.message?.content;
          if (text && text.trim().length > 0) generatedSummary = text.trim();
        }
      } catch (aiErr) {
        console.warn("Live AI generation encountered error, falling back to clinical synthesis:", aiErr);
      }
    }

    if (!generatedSummary) {
      if (mode === "overall_feedback") {
        generatedSummary = synthesizeOverallFeedbackSummary({
          overallFeedback,
          subjective,
          objective,
          assessment,
          plan,
          stepReviewsText,
          biomechSummary,
          clientName,
        });
      } else {
        generatedSummary = synthesizePlainLanguageSummary({
          subjective,
          objective,
          assessment,
          plan,
          clientName,
        });
      }
    }

    // STEP 3: Cache and Persist in Database so subsequent calls are 100% free
    if (targetId) {
      if (targetType === "soap_note") {
        await admin
          .from("soap_notes")
          .update({ client_summary: generatedSummary, updated_at: new Date().toISOString() })
          .eq("id", targetId);
      } else {
        await admin
          .from("submission_reviews")
          .update({ client_summary: generatedSummary, updated_at: new Date().toISOString() })
          .or(`id.eq.${targetId},submission_id.eq.${targetId}`);
      }
    }

    // HIPAA Audit Logging: record synthesis of ePHI summary
    await logAuditEvent({
      action: "EPHI_AI_SYNTHESIS",
      affectedResource: targetType || "soap_notes",
      resourceId: targetId || null,
      metadata: {
        summaryLength: generatedSummary.length,
        deidentified: true,
      },
    });

    return NextResponse.json({
      summary: generatedSummary,
      cached: false,
      newlyGenerated: true,
      source: "generated_and_cached",
      message: "Summary generated and successfully cached in database for future viewings.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
