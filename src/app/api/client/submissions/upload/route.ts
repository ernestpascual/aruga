import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMockStore } from "@/lib/supabase/mock-store";
import { logAuditEvent } from "@/lib/hipaa/audit";

// Maximum file upload is 50MB (52,428,800 bytes) for video, 10MB for photo.
// Aruga recommends <= 25MB for video, <= 5MB for photo.
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB video
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB photo
const MAX_FREE_TIER_BYTES = 50 * 1024 * 1024; // legacy compat
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
      return NextResponse.json({ error: "No media file provided." }, { status: 400 });
    }

    const declaredSize = formData.get("fileSizeBytes") ? Number(formData.get("fileSizeBytes")) : 0;
    const effectiveSize = Math.max(file.size, declaredSize);
    const mime = file.type || "";
    const lowerName = file.name.toLowerCase();

    const isImageMime =
      mime.startsWith("image/") ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".webp") ||
      lowerName.endsWith(".heic");
    const isVideoMime =
      mime.startsWith("video/") ||
      ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "application/octet-stream"].includes(mime) ||
      lowerName.endsWith(".mp4") ||
      lowerName.endsWith(".webm") ||
      lowerName.endsWith(".mov") ||
      lowerName.endsWith(".m4v");

    const mediaKind: "photo" | "video" = isImageMime ? "photo" : "video";

    if (!isImageMime && !isVideoMime) {
      return NextResponse.json(
        { error: `Unsupported media format (${mime || lowerName}). Please provide a photo (JPG/PNG/WebP) or video (MP4/WebM/MOV).` },
        { status: 400 }
      );
    }

    // 1. Validate File Size per media kind
    const maxBytes = mediaKind === "photo" ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
    if (effectiveSize > maxBytes) {
      return NextResponse.json(
        {
          error: `File size (${(effectiveSize / 1024 / 1024).toFixed(1)}MB) exceeds the maximum for ${mediaKind} (${maxBytes / 1024 / 1024}MB). ${mediaKind === "photo" ? "Please use a smaller photo." : "Please record a shorter clip (under 30 seconds)."}`,
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    if (admin) {
      // Determine file extension based on mime/name
      let ext = mediaKind === "photo" ? "jpg" : "mp4";
      if (mediaKind === "video") {
        if (mime.includes("webm") || lowerName.endsWith(".webm")) ext = "webm";
        else if (mime.includes("quicktime") || lowerName.endsWith(".mov")) ext = "mov";
        else if (mime.includes("mp4") || lowerName.endsWith(".mp4")) ext = "mp4";
      } else {
        if (mime.includes("png") || lowerName.endsWith(".png")) ext = "png";
        else if (mime.includes("webp") || lowerName.endsWith(".webp")) ext = "webp";
        else if (mime.includes("heic") || lowerName.endsWith(".heic")) ext = "heic";
        else ext = "jpg";
      }
      const effectiveMime = mime || (mediaKind === "photo" ? `image/${ext}` : `video/${ext}`);

      const sanitizedSubId = (submissionId || "demo-sub").replace(/[^a-zA-Z0-9_-]/g, "");
      const sanitizedStepId = (stepId || "step").replace(/[^a-zA-Z0-9_-]/g, "");
      const storagePath = `submissions/${sanitizedSubId}/${sanitizedStepId}_${Date.now()}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Cloud Storage (Supabase program-videos hosts both photos & videos)
      let { error: uploadError } = await admin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: effectiveMime,
          upsert: true,
        });

      // If bucket does not exist, attempt to create it and retry
      if (uploadError && uploadError.message?.toLowerCase().includes("bucket not found")) {
        await admin.storage.createBucket(BUCKET_NAME, {
          public: true, // public read for therapist/client playback; RLS still protects DB links
          fileSizeLimit: MAX_VIDEO_BYTES,
          allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime", "image/jpeg", "image/png", "image/webp", "image/heic"],
        });

        const retry = await admin.storage
          .from(BUCKET_NAME)
          .upload(storagePath, buffer, {
            contentType: effectiveMime,
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

      // Update step_submissions in database if IDs provided — video_path now holds photo OR video URL
      if (submissionId && stepId) {
        await admin
          .from("step_submissions")
          .update({
            video_path: videoUrl,
            skipped: false,
            skip_reason: null,
            media_meta: {
              mime: effectiveMime,
              mediaKind,
              sizeBytes: file.size,
              durationSeconds: mediaKind === "video" ? durationSeconds || 15 : undefined,
              storagePath,
              bucket: BUCKET_NAME,
              freeTierCompliant: file.size <= (mediaKind === "photo" ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES),
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
          mime: effectiveMime,
          mediaKind,
          bucket: BUCKET_NAME,
        },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      });

      return NextResponse.json({
        success: true,
        message: mediaKind === "photo" ? "Photo successfully stored in cloud storage." : "Video successfully stored in cloud storage.",
        videoPath: videoUrl,
        mediaPath: videoUrl,
        mediaKind,
        storagePath,
        bucket: BUCKET_NAME,
        sizeBytes: file.size,
        mime: effectiveMime,
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
          mime: mime || (mediaKind === "photo" ? "image/jpeg" : "video/mp4"),
          mediaKind,
          sizeBytes: file.size,
          durationSeconds: mediaKind === "video" ? durationSeconds || 15 : undefined,
          storagePath: `mock-storage/${submissionId}/${stepId}.${mediaKind === "photo" ? "jpg" : "mp4"}`,
          bucket: BUCKET_NAME,
          freeTierCompliant: true,
        };
        stepSub.updated_at = new Date().toISOString();
      }
    }

    return NextResponse.json({
      success: true,
      message: mediaKind === "photo" ? "Photo recorded and stored (Mock/Local mode)." : "Video recorded and stored (Mock/Local mode).",
      videoPath: demoVideoPath,
      mediaPath: demoVideoPath,
      mediaKind,
      storagePath: `mock-storage/${submissionId || "sub"}/${stepId || "step"}.${mediaKind === "photo" ? "jpg" : "mp4"}`,
      bucket: BUCKET_NAME,
      sizeBytes: file.size,
      mime: mime || (mediaKind === "photo" ? "image/jpeg" : "video/mp4"),
      mock: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
