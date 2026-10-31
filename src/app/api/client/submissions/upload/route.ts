import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMockStore } from "@/lib/supabase/mock-store";
import { logAuditEvent } from "@/lib/hipaa/audit";

// Maximum file upload is 50MB (52,428,800 bytes).
// Aruga recommends <= 25MB for optimal bandwidth & snappy streaming.
const MAX_FREE_TIER_BYTES = 50 * 1024 * 1024; // 50MB
const BUCKET_NAME = "program-videos";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const submissionId = formData.get("submissionId") as string | null;
    const stepId = formData.get("stepId") as string | null;
    const durationStr = formData.get("durationSeconds") as string | null;
    const durationSeconds = durationStr ? Number(durationStr) : undefined;

    if (!file) {
      return NextResponse.json({ error: "No video file provided." }, { status: 400 });
    }

    const declaredSize = formData.get("fileSizeBytes") ? Number(formData.get("fileSizeBytes")) : 0;
    const effectiveSize = Math.max(file.size, declaredSize);

    // 1. Validate File Size
    if (effectiveSize > MAX_FREE_TIER_BYTES) {
      return NextResponse.json(
        {
          error: `File size (${(effectiveSize / 1024 / 1024).toFixed(1)}MB) exceeds the maximum allowed size of 50MB. Please record a shorter clip (under 30 seconds).`,
        },
        { status: 400 }
      );
    }

    // 2. Validate MIME Type
    const validMimes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-matroska",
      "application/octet-stream", // fallback from some webcams
    ];
    const mime = file.type || "video/mp4";
    const isVideoMime =
      mime.startsWith("video/") ||
      validMimes.includes(mime) ||
      file.name.endsWith(".mp4") ||
      file.name.endsWith(".webm") ||
      file.name.endsWith(".mov");

    if (!isVideoMime) {
      return NextResponse.json(
        { error: `Unsupported media format (${mime}). Please provide an MP4, WebM, or QuickTime video.` },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    if (admin) {
      // Determine file extension
      let ext = "mp4";
      if (mime.includes("webm") || file.name.endsWith(".webm")) ext = "webm";
      else if (mime.includes("quicktime") || file.name.endsWith(".mov")) ext = "mov";

      const sanitizedSubId = (submissionId || "demo-sub").replace(/[^a-zA-Z0-9_-]/g, "");
      const sanitizedStepId = (stepId || "step").replace(/[^a-zA-Z0-9_-]/g, "");
      const storagePath = `submissions/${sanitizedSubId}/${sanitizedStepId}_${Date.now()}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Cloud Storage
      let { error: uploadError } = await admin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: mime,
          upsert: true,
        });

      // If bucket does not exist, attempt to create it and retry
      if (uploadError && uploadError.message?.toLowerCase().includes("bucket not found")) {
        await admin.storage.createBucket(BUCKET_NAME, {
          public: false, // HIPAA compliance: Patient media is strictly private
          fileSizeLimit: MAX_FREE_TIER_BYTES,
          allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
        });

        const retry = await admin.storage
          .from(BUCKET_NAME)
          .upload(storagePath, buffer, {
            contentType: mime,
            upsert: true,
          });
        uploadError = retry.error;
      }

      if (uploadError) {
        return NextResponse.json(
          { error: `Cloud Storage upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Generate signed URL with time-limited token (private bucket)
      let videoUrl = "";
      try {
        const { data: signedData } = await admin.storage
          .from(BUCKET_NAME)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days time-limited signed URL
        if (signedData?.signedUrl) {
          videoUrl = signedData.signedUrl;
        }
      } catch {
        // fallback to public url if signed URL generation fails
        const { data: publicUrlData } = admin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
        videoUrl = publicUrlData.publicUrl;
      }

      if (!videoUrl) {
        const { data: publicUrlData } = admin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
        videoUrl = publicUrlData.publicUrl;
      }

      // Update step_submissions in database if IDs provided
      if (submissionId && stepId) {
        await admin
          .from("step_submissions")
          .update({
            video_path: videoUrl,
            skipped: false,
            skip_reason: null,
            media_meta: {
              mime,
              sizeBytes: file.size,
              durationSeconds: durationSeconds || 15,
              storagePath,
              bucket: BUCKET_NAME,
              freeTierCompliant: file.size <= MAX_FREE_TIER_BYTES,
              uploadedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("submission_id", submissionId)
          .eq("program_step_id", stepId);
      }

      // HIPAA Audit Log: Record ePHI media upload
      await logAuditEvent({
        action: "EPHI_CREATE",
        resourceType: "step_submissions",
        resourceId: submissionId || undefined,
        details: {
          stepId,
          storagePath,
          sizeBytes: file.size,
          mime,
          bucket: BUCKET_NAME,
        },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      });

      return NextResponse.json({
        success: true,
        message: "Video successfully stored in cloud storage.",
        videoPath: videoUrl,
        storagePath,
        bucket: BUCKET_NAME,
        sizeBytes: file.size,
        mime,
      });
    }

    // Mock store fallback (e.g. unit tests or local preview without live credentials)
    const store = getMockStore();
    const demoVideoPath = "/demo/cup_grasp_transfer.mp4";

    if (submissionId && stepId) {
      const stepSub = store.stepSubmissions.find(
        (ss) => ss.submission_id === submissionId && ss.program_step_id === stepId
      );
      if (stepSub) {
        stepSub.video_path = demoVideoPath;
        stepSub.skipped = false;
        stepSub.skip_reason = null;
        stepSub.media_meta = {
          mime,
          sizeBytes: file.size,
          durationSeconds: durationSeconds || 15,
          storagePath: `mock-storage/${submissionId}/${stepId}.mp4`,
          bucket: BUCKET_NAME,
          freeTierCompliant: true,
        };
        stepSub.updated_at = new Date().toISOString();
      }
    }

    return NextResponse.json({
      success: true,
      message: "Video recorded and stored (Mock/Local mode).",
      videoPath: demoVideoPath,
      storagePath: `mock-storage/${submissionId || "sub"}/${stepId || "step"}.mp4`,
      bucket: BUCKET_NAME,
      sizeBytes: file.size,
      mime,
      mock: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
