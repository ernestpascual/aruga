import { NextRequest, NextResponse } from "next/server";
import { draftTherapistFeedback } from "@/lib/meta-ai";
import { MetaApiError } from "@/lib/meta/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      stepInstructions,
      therapistNotes,
      confirmedObservations,
      clientComment,
      skipped,
      skipReason,
    } = body;

    if (!stepInstructions) {
      return NextResponse.json(
        { error: "stepInstructions is required" },
        { status: 400 }
      );
    }

    const result = await draftTherapistFeedback({
      stepInstructions,
      therapistNotes: therapistNotes || "",
      confirmedObservations: Array.isArray(confirmedObservations)
        ? confirmedObservations
        : [],
      clientComment,
      skipped: Boolean(skipped),
      skipReason,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof MetaApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode || 500 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
