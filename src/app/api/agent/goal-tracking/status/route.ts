import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get("patientId");
  return NextResponse.json({ patientId, status: "draft", hasDraft: false });
}
