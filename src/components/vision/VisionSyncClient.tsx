"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Play,
  ScanLine,
  Square,
} from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { PaddleUpgradeButtons } from "@/components/billing/PaddleUpgradeButtons";
import type { OverlayStateSnapshot } from "@/lib/types";

interface VisionSyncClientProps {
  initialOverlay: OverlayStateSnapshot;
  userEmail: string;
}

interface CropRect {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  w: number; // normalized 0..1
  h: number; // normalized 0..1
}

export function VisionSyncClient({
  initialOverlay,
  userEmail,
}: VisionSyncClientProps) {
  const [overlay, setOverlay] = useState<OverlayStateSnapshot>(initialOverlay);
  const [capturing, setCapturing] = useState(false);
  const [ocrActive, setOcrActive] = useState(false);
  const [lastRawText, setLastRawText] = useState<string>("");
  const [lastParsedCash, setLastParsedCash] = useState<number | null>(null);
  const [statusNote, setStatusNote] = useState<string>(
    "Share your OBS preview or console capture window, drag the crop box over the top-right cash counter, and start Vision Sync."
  );

  // Default crop positioned over top-right cash area
  const [crop, setCrop] = useState<CropRect>({
    x: 0.72,
    y: 0.04,
    w: 0.24,
    h: 0.1,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragModeRef = useRef<"move" | "resize" | null>(null);
  const dragStartRef = useRef<{ mx: number; my: number; rect: CropRect }>({
    mx: 0,
    my: 0,
    rect: crop,
  });
  const pendingOutlierRef = useRef<{ value: number; count: number } | null>(
    null
  );
  const currentCashRef = useRef<number>(initialOverlay.cashBalance);

  useEffect(() => {
    currentCashRef.current = overlay.cashBalance;
  }, [overlay.cashBalance]);

  // Draw live video + crop box onto preview canvas
  useEffect(() => {
    if (!capturing) return;
    let rafId = 0;

    const renderFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Dim outer region
          ctx.fillStyle = "rgba(11, 13, 18, 0.5)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const rx = crop.x * canvas.width;
          const ry = crop.y * canvas.height;
          const rw = crop.w * canvas.width;
          const rh = crop.h * canvas.height;

          // Draw crisp un-dimmed crop region
          ctx.drawImage(video, rx, ry, rw, rh, rx, ry, rw, rh);

          // Draw border + resize handle
          ctx.strokeStyle = "#2EC4B6";
          ctx.lineWidth = Math.max(2, canvas.width * 0.003);
          ctx.strokeRect(rx, ry, rw, rh);

          const handleSize = Math.max(12, canvas.width * 0.015);
          ctx.fillStyle = "#F7B267";
          ctx.fillRect(
            rx + rw - handleSize,
            ry + rh - handleSize,
            handleSize,
            handleSize
          );
        }
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [capturing, crop]);

  // Run Tesseract OCR every 2.5 seconds when active
  useEffect(() => {
    if (!capturing || !ocrActive) return;
    let cancelled = false;
    let running = false;

    const runOcrTick = async () => {
      if (cancelled || running) return;
      const video = videoRef.current;
      const cropCanvas = cropCanvasRef.current;
      if (!video || !cropCanvas || video.videoWidth === 0) return;

      running = true;
      try {
        const sx = Math.floor(crop.x * video.videoWidth);
        const sy = Math.floor(crop.y * video.videoHeight);
        const sw = Math.max(20, Math.floor(crop.w * video.videoWidth));
        const sh = Math.max(20, Math.floor(crop.h * video.videoHeight));

        cropCanvas.width = sw * 2;
        cropCanvas.height = sh * 2;
        const cctx = cropCanvas.getContext("2d");
        if (!cctx) return;

        cctx.imageSmoothingEnabled = false;
        cctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw * 2, sh * 2);

        const Tesseract = await import("tesseract.js");
        const result = await Tesseract.recognize(cropCanvas, "eng", {
          tessedit_char_whitelist: "$0123456789,",
        } as Record<string, string>);

        if (cancelled) return;
        const raw = result.data.text.trim();
        setLastRawText(raw);

        const digitsOnly = raw.replace(/[^0-9]/g, "");
        if (!digitsOnly) return;
        const parsed = Number(digitsOnly);
        if (!Number.isFinite(parsed) || parsed < 0) return;

        setLastParsedCash(parsed);

        // Sanity filter: ignore OCR noise jumps > 50x current balance unless confirmed twice
        const current = Math.max(1, currentCashRef.current);
        const isExtremeJump = parsed > current * 50;

        if (isExtremeJump) {
          if (
            pendingOutlierRef.current &&
            pendingOutlierRef.current.value === parsed
          ) {
            pendingOutlierRef.current.count += 1;
          } else {
            pendingOutlierRef.current = { value: parsed, count: 1 };
          }
          if (pendingOutlierRef.current.count < 2) {
            setStatusNote(
              `Outlier $${parsed.toLocaleString("en-US")} detected. Awaiting second confirmation frame.`
            );
            return;
          }
        }

        pendingOutlierRef.current = null;
        if (parsed !== currentCashRef.current) {
          const res = await fetch("/api/overlay/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cashBalance: parsed }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              overlay?: OverlayStateSnapshot;
            };
            if (data.overlay) {
              setOverlay(data.overlay);
              setStatusNote(
                `Synced $${parsed.toLocaleString("en-US")} to live HUD.`
              );
            }
          }
        }
      } catch {
        setStatusNote("OCR frame failed. Verify crop box covers cash digits.");
      } finally {
        running = false;
      }
    };

    void runOcrTick();
    const timer = setInterval(() => void runOcrTick(), 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [capturing, ocrActive, crop]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        setCapturing(false);
        setOcrActive(false);
      });
      setCapturing(true);
      setStatusNote(
        "Capture active. Drag the teal box over the cash digits, then click Start OCR Sync."
      );
    } catch {
      setStatusNote("Screen capture permission was cancelled.");
    }
  };

  const stopCapture = () => {
    setOcrActive(false);
    setCapturing(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    const nearBottomRight =
      Math.abs(nx - (crop.x + crop.w)) < 0.04 &&
      Math.abs(ny - (crop.y + crop.h)) < 0.06;

    const insideBox =
      nx >= crop.x &&
      nx <= crop.x + crop.w &&
      ny >= crop.y &&
      ny <= crop.y + crop.h;

    if (nearBottomRight) {
      dragModeRef.current = "resize";
    } else if (insideBox) {
      dragModeRef.current = "move";
    } else {
      dragModeRef.current = null;
      return;
    }

    dragStartRef.current = { mx: nx, my: ny, rect: { ...crop } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragModeRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const dx = nx - dragStartRef.current.mx;
    const dy = ny - dragStartRef.current.my;
    const base = dragStartRef.current.rect;

    if (dragModeRef.current === "move") {
      setCrop({
        ...base,
        x: Math.min(1 - base.w, Math.max(0, base.x + dx)),
        y: Math.min(1 - base.h, Math.max(0, base.y + dy)),
      });
    } else if (dragModeRef.current === "resize") {
      setCrop({
        ...base,
        w: Math.min(1 - base.x, Math.max(0.06, base.w + dx)),
        h: Math.min(1 - base.y, Math.max(0.04, base.h + dy)),
      });
    }
  };

  const handlePointerUp = () => {
    dragModeRef.current = null;
  };

  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F4F5F7] flex flex-col">
      <TopNav activePath="/dashboard/vision" isSignedIn />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8D96A5] hover:text-[#F4F5F7]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Setup Hub</span>
            </Link>
            <h1 className="font-hud font-extrabold text-4xl uppercase tracking-wide flex items-center gap-2.5">
              <ScanLine className="w-7 h-7 text-[#2EC4B6]" />
              <span>VISION SYNC SCREEN OCR</span>
            </h1>
            <p className="text-sm text-[#8D96A5]">
              Reads your capture card cash counter every 2.5 seconds in-browser
              using Tesseract.js with zero video uploaded.
            </p>
          </div>
          <div className="rounded-xl bg-[#131720] border border-white/10 px-4 py-2.5 text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8D96A5]">
              LIVE OVERLAY CASH
            </div>
            <div className="font-hud font-extrabold text-3xl text-[#2EC4B6]">
              ${overlay.cashBalance.toLocaleString("en-US")}
            </div>
          </div>
        </div>

        {overlay.plan === "free" && (
          <div className="broadcast-card rounded-2xl p-5 border-[#F7B267]/30 space-y-3">
            <div className="text-sm font-bold text-[#F7B267]">
              Vision Sync OCR is a Pro Broadcaster Feature
            </div>
            <p className="text-xs text-[#8D96A5]">
              Upgrade to Pro Broadcaster to unlock automated OCR screen capture,
              custom HUD themes, custom mission checklists, and zero watermark.
            </p>
            <PaddleUpgradeButtons
              userId={overlay.userId}
              userEmail={userEmail}
              currentPlan={overlay.plan}
              compact
            />
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 broadcast-card rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {!capturing ? (
                  <button
                    type="button"
                    disabled={overlay.plan === "free"}
                    onClick={() => void startCapture()}
                    className="h-10 px-4 rounded-xl bg-[#F25C54] text-[#0B0D12] font-extrabold text-sm inline-flex items-center gap-2 disabled:opacity-45"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Select Capture Window</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setOcrActive((v) => !v)}
                      className={`h-10 px-4 rounded-xl font-extrabold text-sm inline-flex items-center gap-2 ${
                        ocrActive
                          ? "bg-[#F7B267] text-[#0B0D12]"
                          : "bg-[#2EC4B6] text-[#0B0D12]"
                      }`}
                    >
                      {ocrActive ? (
                        <>
                          <Square className="w-4 h-4" />
                          <span>Pause OCR Sync</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span>Start OCR Sync</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={stopCapture}
                      className="h-10 px-4 rounded-xl bg-[#0B0D12] border border-white/15 text-sm font-bold text-[#F4F5F7]"
                    >
                      Stop Capture
                    </button>
                  </>
                )}
              </div>
              <span className="text-xs font-semibold text-[#8D96A5]">
                Drag teal box to move | Drag amber corner to resize
              </span>
            </div>

            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#0B0D12] border border-white/10 flex items-center justify-center">
              <video ref={videoRef} className="hidden" muted playsInline />
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={`w-full h-full object-contain cursor-crosshair ${
                  capturing ? "block" : "hidden"
                }`}
              />
              {!capturing && (
                <div className="text-center px-6 space-y-2">
                  <ScanLine className="w-10 h-10 text-[#8D96A5] mx-auto" />
                  <p className="text-sm font-semibold text-[#F4F5F7]">
                    No Capture Window Selected
                  </p>
                  <p className="text-xs text-[#8D96A5] max-w-sm">
                    Select your OBS Studio projector window or console capture
                    feed to position the OCR crop box.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="broadcast-card rounded-2xl p-5 space-y-3">
              <h2 className="font-hud font-extrabold text-2xl uppercase tracking-wide">
                OCR Telemetry
              </h2>
              <div className="rounded-xl bg-[#0B0D12] border border-white/8 p-3 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#8D96A5]">
                  Cropped Input Preview
                </div>
                <canvas
                  ref={cropCanvasRef}
                  className="w-full h-16 object-contain bg-[#131720] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#0B0D12] border border-white/8 p-3">
                  <div className="text-[11px] font-bold uppercase text-[#8D96A5]">
                    RAW OCR
                  </div>
                  <div className="text-sm font-bold text-[#F4F5F7] truncate mt-0.5">
                    {lastRawText || "Waiting"}
                  </div>
                </div>
                <div className="rounded-xl bg-[#0B0D12] border border-white/8 p-3">
                  <div className="text-[11px] font-bold uppercase text-[#8D96A5]">
                    PARSED CASH
                  </div>
                  <div className="font-hud font-extrabold text-xl text-[#2EC4B6] mt-0.5">
                    {lastParsedCash !== null
                      ? `$${lastParsedCash.toLocaleString("en-US")}`
                      : "$0"}
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-[#0B0D12] border border-white/8 p-3 flex items-start gap-2 text-xs text-[#8D96A5]">
                <CheckCircle2 className="w-4 h-4 text-[#2EC4B6] shrink-0 mt-0.5" />
                <span>{statusNote}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
