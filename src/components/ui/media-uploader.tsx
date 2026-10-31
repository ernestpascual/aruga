"use client";

import React, { useState, useRef, useEffect } from "react";
import { Video, Camera, Upload, CheckCircle2, AlertCircle, Clock, Sparkles, Image as ImageIcon, RotateCcw, Square } from "lucide-react";
import { Button } from "./button";
import { siteConfig } from "@/config/site";

interface MediaUploaderProps {
  onMediaReady: (blob: Blob, meta: { mime: string; sizeBytes: number; durationSeconds?: number; formatSupported: boolean; mediaKind: "photo" | "video" }) => void;
  existingMediaPath?: string | null;
  existingMediaMeta?: { mime?: string; mediaKind?: "photo" | "video" } | null;
  onReset?: () => void;
  isUploading?: boolean;
  className?: string;
}

export function MediaUploader({ onMediaReady, existingMediaPath, existingMediaMeta, onReset, isUploading = false, className = "" }: MediaUploaderProps) {
  const [activeTab, setActiveTab] = useState<"video" | "photo">("video");
  const [mode, setMode] = useState<"idle" | "requesting" | "recording" | "recorded">("idle");
  const [recordTime, setRecordTime] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"photo" | "video" | null>(null);
  const [isFormatAiReady, setIsFormatAiReady] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const videoLiveRef = useRef<HTMLVideoElement>(null);
  const photoVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const maxSeconds = siteConfig.videoLimits.maxDurationSeconds;
  const maxBytesVideo = siteConfig.videoLimits.maxSizeBytes;
  const maxBytesPhoto = 10 * 1024 * 1024;

  useEffect(() => {
    // Auto-select tab based on existing media type
    if (existingMediaMeta?.mediaKind === "photo" || (existingMediaMeta?.mime && existingMediaMeta.mime.startsWith("image/"))) {
      setActiveTab("photo");
    } else if (existingMediaMeta?.mediaKind === "video" || (existingMediaMeta?.mime && existingMediaMeta.mime.startsWith("video/"))) {
      setActiveTab("video");
    }
  }, [existingMediaMeta]);

  useEffect(() => {
    return () => {
      stopTracks();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const stopTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const getSupportedMimeType = (): { mime: string; isAiReady: boolean } => {
    const preferred = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=h264", "video/webm;codecs=vp8,opus", "video/webm"];
    for (const t of preferred) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
        return { mime: t, isAiReady: t.includes("mp4") || t.includes("h264") };
      }
    }
    return { mime: "video/webm", isAiReady: false };
  };

  // ---- Video recording ----
  const startCameraVideo = async () => {
    setErrorMsg(null);
    setMode("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: true });
      mediaStreamRef.current = stream;
      if (videoLiveRef.current) {
        videoLiveRef.current.srcObject = stream;
        videoLiveRef.current.muted = true;
        await videoLiveRef.current.play();
      }
      const { mime, isAiReady } = getSupportedMimeType();
      setIsFormatAiReady(isAiReady);
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stopTracks();
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        if (blob.size > maxBytesVideo) {
          setErrorMsg(`Recording exceeds ${Math.round(maxBytesVideo / 1024 / 1024)}MB. Please record shorter.`);
          setMode("idle");
          return;
        }
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewKind("video");
        setMode("recorded");
        onMediaReady(blob, { mime, sizeBytes: blob.size, durationSeconds: recordTime, formatSupported: isAiReady, mediaKind: "video" });
      };
      recorder.start(500);
      setMode("recording");
      setRecordTime(0);
      const start = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setRecordTime(elapsed);
        if (elapsed >= maxSeconds) stopRecording();
      }, 250);
    } catch (err: unknown) {
      stopTracks();
      setErrorMsg(`Camera access failed: ${err instanceof Error ? err.message : String(err)}. Check permissions.`);
      setMode("idle");
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
  };

  // ---- Photo camera ----
  const startCameraPhoto = async () => {
    setErrorMsg(null);
    setMode("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } });
      mediaStreamRef.current = stream;
      if (photoVideoRef.current) {
        photoVideoRef.current.srcObject = stream;
        await photoVideoRef.current.play();
      }
      setMode("recording");
    } catch (err: unknown) {
      stopTracks();
      setErrorMsg(`Camera access failed: ${err instanceof Error ? err.message : String(err)}. Check permissions.`);
      setMode("idle");
    }
  };

  const capturePhoto = () => {
    const video = photoVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (blob.size > maxBytesPhoto) {
        setErrorMsg(`Photo exceeds ${maxBytesPhoto / 1024 / 1024}MB. Try a lower resolution.`);
        return;
      }
      stopTracks();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewKind("photo");
      setMode("recorded");
      onMediaReady(blob, { mime: "image/jpeg", sizeBytes: blob.size, formatSupported: true, mediaKind: "photo" });
    }, "image/jpeg", 0.85);
  };

  const hasMedia = Boolean(previewUrl || existingMediaPath);
  const currentSrc = previewUrl || existingMediaPath || "";
  const isPhotoPreview = previewKind === "photo" || Boolean(existingMediaMeta?.mime?.startsWith("image/")) || existingMediaMeta?.mediaKind === "photo" || /\.(jpg|jpeg|png|webp)$/i.test(currentSrc);

  const handleRetake = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewKind(null);
    setRecordTime(0);
    setErrorMsg(null);
    setMode("idle");
    onReset?.();
  };

  const processFile = (file: File) => {
    setErrorMsg(null);
    const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic)$/i.test(file.name);
    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name);
    if (!isImage && !isVideo) {
      setErrorMsg("Please select a valid photo (JPG/PNG/WebP) or video (MP4/WebM/MOV).");
      return;
    }
    const limit = isImage ? maxBytesPhoto : maxBytesVideo;
    if (file.size > limit) {
      setErrorMsg(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${limit / 1024 / 1024}MB for ${isImage ? "photo" : "video"}.`);
      return;
    }
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPreviewKind(isImage ? "photo" : "video");
    setMode("recorded");
    setActiveTab(isImage ? "photo" : "video");
    setIsFormatAiReady(isVideo ? file.type === "video/mp4" || file.name.endsWith(".mp4") : true);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (isImage) {
      onMediaReady(file, { mime: file.type || "image/jpeg", sizeBytes: file.size, formatSupported: true, mediaKind: "photo" });
    } else {
      const tempVideo = document.createElement("video");
      tempVideo.src = url;
      tempVideo.onloadedmetadata = () => {
        const dur = Math.round(tempVideo.duration) || 15;
        onMediaReady(file, { mime: file.type || "video/mp4", sizeBytes: file.size, durationSeconds: dur, formatSupported: file.type === "video/mp4", mediaKind: "video" });
      };
    }
  };

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current += 1; if (e.dataTransfer.items?.length) setIsDragging(true); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current -= 1; if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); } };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); dragCounter.current = 0; setIsDragging(false);
    if (e.dataTransfer.files?.length) processFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`space-y-4 rounded-xl border transition-all duration-200 p-4 ${isDragging ? "border-teal-400 bg-teal-950/20 shadow-[0_0_30px_rgba(20,184,166,0.25)] ring-1 ring-teal-400/50" : "border-zinc-800 bg-zinc-900/70"} ${className}`}
    >
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
        <button
          type="button"
          onClick={() => { setActiveTab("video"); setErrorMsg(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${activeTab === "video" ? "bg-teal-950 border-teal-500/50 text-teal-300" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
        >
          <Video className="w-3.5 h-3.5" /> Video
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("photo"); setErrorMsg(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${activeTab === "photo" ? "bg-sky-950 border-sky-500/50 text-sky-300" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
        >
          <ImageIcon className="w-3.5 h-3.5" /> Photo
        </button>
        <span className="ml-auto text-[11px] text-zinc-500 hidden sm:inline">
          {activeTab === "video" ? `Max ${maxSeconds}s • MP4/WebM` : `Max ${maxBytesPhoto / 1024 / 1024}MB • JPG/PNG/WebP`}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400 pb-1">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-teal-400" />
          {activeTab === "video" ? `Up to ${maxSeconds}s per step` : "Photo per step — drag & drop or capture"}
        </span>
        {isFormatAiReady ? <span className="text-teal-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Supabase hosted</span> : <span className="text-amber-400">Manual review</span>}
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-950/60 border border-red-800/80 p-3 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Viewport */}
      <div className={`relative aspect-video w-full overflow-hidden rounded-lg bg-black border flex items-center justify-center ${isDragging ? "border-teal-400 ring-2 ring-teal-400/50" : "border-zinc-800"}`}>
        {isDragging && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm border-2 border-dashed border-teal-400 rounded-lg p-6 text-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-teal-950/80 border border-teal-500/50 flex items-center justify-center text-teal-300 mb-2.5 animate-bounce">
              <Upload className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-teal-300">Drop your {activeTab === "photo" ? "photo" : "video"} here</h4>
            <p className="text-xs text-zinc-400 mt-1">{activeTab === "photo" ? "JPG, PNG, WebP up to 10MB" : "MP4, WebM up to 50MB"}</p>
          </div>
        )}

        {mode === "recording" ? (
          activeTab === "photo" ? (
            <>
              <video ref={photoVideoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <Button type="button" onClick={capturePhoto} className="gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs">
                  <Camera className="w-4 h-4" /> Capture Photo
                </Button>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </>
          ) : (
            <>
              <video ref={videoLiveRef} className="w-full h-full object-cover" playsInline autoPlay muted />
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-950/90 border border-red-700/80 text-red-200 text-xs px-2.5 py-1 rounded-full animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>REC {recordTime}s / {maxSeconds}s</span>
              </div>
            </>
          )
        ) : hasMedia ? (
          isPhotoPreview ? (
            <img src={currentSrc} alt="Submitted media" className="w-full h-full object-contain" />
          ) : (
            <video src={currentSrc} controls playsInline className="w-full h-full object-contain" />
          )
        ) : (
          <div onClick={() => (activeTab === "photo" ? photoInputRef.current?.click() : fileInputRef.current?.click())} className="flex flex-col items-center justify-center p-6 text-center text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors w-full h-full group">
            <div className="w-12 h-12 rounded-full bg-zinc-900/90 border border-zinc-800 group-hover:border-teal-500/50 group-hover:bg-zinc-800 text-zinc-400 group-hover:text-teal-400 flex items-center justify-center mb-2.5 transition-all">
              <Upload className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-zinc-200 group-hover:text-teal-300">
              Drag & drop {activeTab === "photo" ? "photo" : "video"} here, or <span className="text-teal-400 underline underline-offset-4">browse</span>
            </p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
              {activeTab === "photo" ? "JPG/PNG/WebP up to 10MB • Or use camera" : `MP4/WebM up to ${maxSeconds}s • Or record`}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="pt-1">
        {mode === "recording" && activeTab === "video" && (
          <Button type="button" variant="danger" onClick={stopRecording} className="w-full gap-2 font-semibold text-xs">
            <Square className="w-4 h-4 fill-current" /> Stop Recording ({recordTime}s)
          </Button>
        )}
        {mode === "requesting" && <div className="flex items-center gap-2 text-xs text-teal-400 py-2"><div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /><span>Starting camera...</span></div>}
        {mode !== "recording" && mode !== "requesting" && (
          <>
            {hasMedia ? (
              <div className="flex flex-row items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  {isUploading ? <span className="text-amber-400 flex items-center gap-1.5"><div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />Uploading to Supabase...</span> : <span className="text-teal-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{isPhotoPreview ? "Photo in Supabase" : "Video in Supabase"}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={handleRetake} className="gap-1.5 text-xs text-zinc-300 hover:text-red-400">
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => (activeTab === "photo" ? photoInputRef.current?.click() : fileInputRef.current?.click())} className="gap-1.5 text-xs text-zinc-300">
                    <Upload className="w-3.5 h-3.5" /> Replace
                  </Button>
                </div>
              </div>
            ) : activeTab === "photo" ? (
              <div className="flex flex-row items-center gap-2 w-full">
                <Button type="button" onClick={startCameraPhoto} disabled={isUploading} className="gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs">
                  <Camera className="w-4 h-4" /> Take Photo
                </Button>
                <Button type="button" variant="outline" onClick={() => photoInputRef.current?.click()} disabled={isUploading} className="gap-2 text-zinc-300 text-xs">
                  <Upload className="w-4 h-4" /> Upload Photo
                </Button>
              </div>
            ) : (
              <div className="flex flex-row items-center gap-2 w-full">
                <Button type="button" onClick={startCameraVideo} disabled={isUploading} className="gap-2 bg-teal-600 hover:bg-teal-500 text-zinc-950 font-semibold text-xs">
                  <Video className="w-4 h-4" /> Start Recording
                </Button>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="gap-2 text-zinc-300 text-xs">
                  <Upload className="w-4 h-4" /> Upload Video
                </Button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>
    </div>
  );
}
