"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Video,
  VideoOff,
  Square,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "./button";
import { siteConfig } from "@/config/site";

interface VideoRecorderProps {
  onVideoReady: (videoBlob: Blob, metadata: { mime: string; sizeBytes: number; durationSeconds: number; formatSupported: boolean }) => void;
  existingVideoPath?: string | null;
  className?: string;
}

export function VideoRecorder({
  onVideoReady,
  existingVideoPath,
  className = "",
}: VideoRecorderProps) {
  const [mode, setMode] = useState<"idle" | "requesting" | "recording" | "recorded" | "uploading">("idle");
  const [recordTime, setRecordTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFormatAiReady, setIsFormatAiReady] = useState(true);

  const videoLiveRef = useRef<HTMLVideoElement>(null);
  const videoRecordedRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSeconds = siteConfig.videoLimits.maxDurationSeconds;
  const maxBytes = siteConfig.videoLimits.maxSizeBytes;

  // Cleanup tracks on unmount
  useEffect(() => {
    return () => {
      stopTracks();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const stopTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  // Determine supported mime type for MediaRecorder
  const getSupportedMimeType = (): { mime: string; isAiReady: boolean } => {
    const preferredTypes = [
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    for (const t of preferredTypes) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
        const isMp4 = t.includes("mp4") || t.includes("h264");
        return { mime: t, isAiReady: isMp4 };
      }
    }
    return { mime: "video/webm", isAiReady: false };
  };

  const startCamera = async () => {
    setErrorMsg(null);
    setMode("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: true,
      });

      mediaStreamRef.current = stream;
      if (videoLiveRef.current) {
        videoLiveRef.current.srcObject = stream;
        videoLiveRef.current.muted = true;
        await videoLiveRef.current.play();
      }

      // Check supported recording format
      const { mime, isAiReady } = getSupportedMimeType();
      setIsFormatAiReady(isAiReady);

      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 2500000, // 2.5 Mbps for clean 720p
      });

      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stopTracks();
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        if (blob.size > maxBytes) {
          setErrorMsg(`Recording exceeds maximum size of ${Math.round(maxBytes / 1024 / 1024)}MB. Please record a shorter clip.`);
          setMode("idle");
          return;
        }

        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setMode("recorded");

        onVideoReady(blob, {
          mime,
          sizeBytes: blob.size,
          durationSeconds: recordTime,
          formatSupported: isAiReady,
        });
      };

      recorder.start(500); // 500ms time slice
      setMode("recording");
      setRecordTime(0);

      const startMs = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        setRecordTime(elapsed);
        if (elapsed >= maxSeconds) {
          stopRecording();
        }
      }, 250);
    } catch (err: unknown) {
      stopTracks();
      const errText = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Camera access failed: ${errText}. Please check browser permissions.`);
      setMode("idle");
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRetake = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setRecordTime(0);
    setErrorMsg(null);
    setMode("idle");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxBytes) {
      setErrorMsg(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of ${maxBytes / 1024 / 1024}MB.`);
      return;
    }

    const isMp4 = file.type === "video/mp4" || file.name.endsWith(".mp4");
    setIsFormatAiReady(isMp4);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setMode("recorded");

    // Extract approximate video duration using temporary video element
    const tempVideo = document.createElement("video");
    tempVideo.src = url;
    tempVideo.onloadedmetadata = () => {
      const dur = Math.round(tempVideo.duration) || 15;
      onVideoReady(file, {
        mime: file.type || "video/mp4",
        sizeBytes: file.size,
        durationSeconds: dur,
        formatSupported: isMp4,
      });
    };
  };

  return (
    <div className={`space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 ${className}`}>
      {/* Informative notice */}
      <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800/80">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-teal-400" />
          Maximum {maxSeconds} seconds per step • MP4/WebM
        </span>
        {isFormatAiReady ? (
          <span className="text-teal-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Meta AI ready format
          </span>
        ) : (
          <span className="text-amber-400">Manual review format</span>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Video Viewport Area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black border border-zinc-800 flex items-center justify-center">
        {mode === "recording" || mode === "requesting" ? (
          <>
            <video
              ref={videoLiveRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
              muted
            />
            {/* Live Recording Header with Timer */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-950/90 border border-red-700/80 text-red-200 text-xs px-2.5 py-1 rounded-full animate-pulse shadow">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>REC {recordTime}s / {maxSeconds}s</span>
            </div>
          </>
        ) : previewUrl ? (
          <video
            ref={videoRecordedRef}
            src={previewUrl}
            controls
            playsInline
            className="w-full h-full object-contain"
          />
        ) : existingVideoPath ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-400">
            <CheckCircle2 className="w-10 h-10 text-teal-400 mb-2" />
            <p className="text-sm font-medium text-zinc-200">Video saved for this step</p>
            <p className="text-xs text-zinc-500 mt-1">You can replace or retake this recording below</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-500">
            <Video className="w-10 h-10 text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-400">Ready to record activity video</p>
            <p className="text-xs text-zinc-500 mt-1">
              Position your camera to show your tabletop movements clearly.
            </p>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {mode === "idle" && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              onClick={startCamera}
              className="flex-1 sm:flex-none gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold"
            >
              <Video className="w-4 h-4" />
              Start Recording
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none gap-2 text-zinc-300"
            >
              <Upload className="w-4 h-4" />
              Upload Video
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {mode === "recording" && (
          <Button
            type="button"
            variant="danger"
            onClick={stopRecording}
            className="w-full gap-2 font-semibold"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop Recording ({recordTime}s)
          </Button>
        )}

        {mode === "recorded" && (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-teal-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Recording ready
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetake}
                className="gap-1.5 text-xs text-zinc-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retake
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 text-xs text-zinc-300"
              >
                <Upload className="w-3.5 h-3.5" />
                Replace with File
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}
      </div>
    </div>
  );
}
