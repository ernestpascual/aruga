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
  onReset?: () => void;
  isUploading?: boolean;
  className?: string;
}

export function VideoRecorder({
  onVideoReady,
  existingVideoPath,
  onReset,
  isUploading = false,
  className = "",
}: VideoRecorderProps) {
  const [mode, setMode] = useState<"idle" | "requesting" | "recording" | "recorded" | "uploading">("idle");
  const [recordTime, setRecordTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFormatAiReady, setIsFormatAiReady] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

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

  const hasVideo = Boolean(previewUrl || existingVideoPath);
  const currentVideoSrc = previewUrl || existingVideoPath || "";

  const handleRetake = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setRecordTime(0);
    setErrorMsg(null);
    setMode("idle");
    onReset?.();
  };

  const processVideoFile = (file: File) => {
    setErrorMsg(null);

    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name);
    if (!isVideo) {
      setErrorMsg("Please select or drop a valid video file (MP4, WebM, or MOV).");
      return;
    }

    if (file.size > maxBytes) {
      setErrorMsg(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of ${maxBytes / 1024 / 1024}MB.`);
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    const isMp4 = file.type === "video/mp4" || file.name.endsWith(".mp4");
    setIsFormatAiReady(isMp4);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setMode("recorded");

    // Reset file input value so choosing another file triggers change cleanly
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processVideoFile(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processVideoFile(file);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`space-y-4 rounded-xl border transition-all duration-200 p-4 ${
        isDragging
          ? "border-teal-400 bg-teal-950/20 shadow-[0_0_30px_rgba(20,184,166,0.25)] ring-1 ring-teal-400/50"
          : "border-zinc-800 bg-zinc-900/70"
      } ${className}`}
    >
      {/* Informative notice */}
      <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800/80">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-teal-400" />
          Maximum {maxSeconds} seconds per step • Drag & drop or upload MP4/WebM
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
      <div
        className={`relative aspect-video w-full overflow-hidden rounded-lg bg-black border transition-all duration-200 flex items-center justify-center ${
          isDragging ? "border-teal-400 ring-2 ring-teal-400/50" : "border-zinc-800"
        }`}
      >
        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm border-2 border-dashed border-teal-400 rounded-lg p-6 text-center animate-in fade-in zoom-in-95 pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-teal-950/80 border border-teal-500/50 flex items-center justify-center text-teal-300 mb-2.5 animate-bounce shadow-[0_0_20px_rgba(20,184,166,0.3)]">
              <Upload className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-teal-300">Drop your exercise video here</h4>
            <p className="text-xs text-zinc-400 mt-1">MP4, WebM, or MOV up to 50MB</p>
          </div>
        )}

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
        ) : hasVideo ? (
          <video
            ref={videoRecordedRef}
            src={currentVideoSrc}
            controls
            playsInline
            className="w-full h-full object-contain"
          />
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 text-center text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors w-full h-full group"
          >
            <div className="w-12 h-12 rounded-full bg-zinc-900/90 border border-zinc-800 group-hover:border-teal-500/50 group-hover:bg-zinc-800 text-zinc-400 group-hover:text-teal-400 flex items-center justify-center mb-2.5 transition-all shadow-sm">
              <Upload className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-zinc-200 group-hover:text-teal-300 transition-colors">
              Drag &amp; drop video here, or <span className="text-teal-400 underline underline-offset-4">browse file</span>
            </p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
              MP4 or WebM (up to {maxSeconds}s) • Or click &ldquo;Start Recording&rdquo; below
            </p>
          </div>
        )}
      </div>

      {/* Action Controls - Single Row Alignment */}
      <div className="pt-1">
        {mode === "recording" && (
          <Button
            type="button"
            variant="danger"
            onClick={stopRecording}
            className="w-full gap-2 font-semibold text-xs whitespace-nowrap"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop Recording ({recordTime}s)
          </Button>
        )}

        {mode === "requesting" && (
          <div className="flex flex-row items-center gap-2 text-xs text-teal-400 py-2">
            <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Initializing camera...</span>
          </div>
        )}

        {mode !== "recording" && mode !== "requesting" && (
          <>
            {hasVideo ? (
              <div className="flex flex-row items-center justify-between gap-3 w-full">
                <div className="flex flex-row items-center gap-1.5 text-xs font-medium whitespace-nowrap">
                  {isUploading ? (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                      Uploading to cloud...
                    </span>
                  ) : (
                    <span className="text-teal-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      {previewUrl ? "Recording captured" : "Video uploaded to cloud"}
                    </span>
                  )}
                </div>

                <div className="flex flex-row items-center gap-2 whitespace-nowrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={handleRetake}
                    className="gap-1.5 text-xs text-zinc-300 hover:text-red-400 hover:border-red-800/80 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset & Retake
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5 text-xs text-zinc-300 whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Replace with File
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-row items-center gap-2 w-full whitespace-nowrap">
                <Button
                  type="button"
                  onClick={startCamera}
                  disabled={isUploading}
                  className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs whitespace-nowrap"
                >
                  <Video className="w-4 h-4" />
                  Start Recording
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gap-2 text-zinc-300 text-xs whitespace-nowrap"
                >
                  <Upload className="w-4 h-4" />
                  Upload Video
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </>
        )}
      </div>
    </div>
  );
}
