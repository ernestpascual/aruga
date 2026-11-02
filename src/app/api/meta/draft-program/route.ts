import { NextRequest, NextResponse } from "next/server";
import { draftHomeProgram } from "@/lib/meta-ai";
import { MetaApiError } from "@/lib/meta/errors";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawInstructions, discipline, currentTitle } = body;

    if (!rawInstructions || typeof rawInstructions !== "string") {
      return NextResponse.json(
        { error: "rawInstructions is required" },
        { status: 400 }
      );
    }

    const result = await draftHomeProgram({
      rawInstructions,
      discipline,
      currentTitle,
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
