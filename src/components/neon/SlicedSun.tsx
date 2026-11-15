"use client";

import React, { useId } from "react";
import { ViewfinderBrackets } from "./ViewfinderBrackets";

export function SlicedSunMark({ size = 36 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${Math.round(size * (230 / 1024))}px`,
        background: "var(--bg-deep)",
        border: "1px solid rgba(25, 227, 198, 0.35)",
      }}
    >
      <ViewfinderBrackets size={Math.max(7, Math.round(size * 0.24))} thickness={1.75} offset={2} animateLock={false} />
      <svg
        width={Math.round(size * 0.64)}
        height={Math.round(size * 0.64)}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`sun-${uid}`} x1="32" y1="8" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD65C" />
            <stop offset="100%" stopColor="#FF3D7F" />
          </linearGradient>
          <mask id={`slices-${uid}`}>
            <path d="M8 46 A24 24 0 0 1 56 46 Z" fill="#fff" />
            <rect x="6" y="29" width="52" height="2" fill="#000" />
            <rect x="6" y="34" width="52" height="2.8" fill="#000" />
            <rect x="6" y="39.5" width="52" height="3.6" fill="#000" />
          </mask>
        </defs>
        <rect
          x="6"
          y="16"
          width="52"
          height="32"
          fill={`url(#sun-${uid})`}
          mask={`url(#slices-${uid})`}
        />
      </svg>
    </div>
  );
}

export function SlicedSunGauge({
  percent,
  burst = false,
  compact = false,
}: {
  percent: number;
  burst?: boolean;
  compact?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const clamped = Math.max(0, Math.min(100, percent));
  // Semicircle sits from y=14 to y=68 (height 54)
  const fillTop = 68 - (54 * clamped) / 100;

  return (
    <div
      className={`relative inline-flex items-end justify-center ${
        compact ? "w-24 h-14" : "w-36 h-20"
      }`}
    >
      {burst && (
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full pointer-events-none animate-sunrise-burst"
          style={{
            background:
              "radial-gradient(circle at 50% 85%, rgba(255,214,92,0.85) 0%, rgba(255,61,127,0.35) 45%, transparent 72%)",
          }}
        />
      )}
      <svg
        viewBox="0 0 120 72"
        className="w-full h-full overflow-visible"
        aria-label={`Story progress ${clamped}%`}
      >
        <defs>
          <linearGradient id={`gauge-grad-${uid}`} x1="60" y1="14" x2="60" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD65C" />
            <stop offset="65%" stopColor="#FF3D7F" />
            <stop offset="100%" stopColor="#FFA23A" />
          </linearGradient>
          <mask id={`gauge-slices-${uid}`}>
            <path d="M10 68 A50 50 0 0 1 110 68 Z" fill="#fff" />
            <rect x="6" y="34" width="108" height="2.2" fill="#000" />
            <rect x="6" y="42" width="108" height="3.2" fill="#000" />
            <rect x="6" y="51" width="108" height="4.2" fill="#000" />
            <rect x="6" y="61" width="108" height="5" fill="#000" />
          </mask>
          <clipPath id={`gauge-fill-${uid}`}>
            <rect x="0" y={fillTop} width="120" height={72 - fillTop} />
          </clipPath>
        </defs>

        {/* Empty track semicircle */}
        <path
          d="M10 68 A50 50 0 0 1 110 68 Z"
          fill="#3C2464"
          mask={`url(#gauge-slices-${uid})`}
          opacity="0.7"
        />

        {/* Active sliced-sun fill rising from bottom */}
        <rect
          x="8"
          y="14"
          width="104"
          height="56"
          fill={`url(#gauge-grad-${uid})`}
          mask={`url(#gauge-slices-${uid})`}
          clipPath={`url(#gauge-fill-${uid})`}
          style={{ transition: "all 280ms cubic-bezier(0.22, 1.2, 0.36, 1)" }}
        />
      </svg>
    </div>
  );
}

export function SlicedSunLoader({ label = "Syncing HUD..." }: { label?: string }) {
  const widths = [44, 62, 78, 92];
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-6"
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-1.5">
        {widths.map((w, idx) => (
          <div
            key={w}
            className="rounded-full"
            style={{
              width: `${w}px`,
              height: `${4 + idx * 1.4}px`,
              background:
                idx < 2
                  ? "var(--sun-yellow)"
                  : idx === 2
                    ? "var(--pink)"
                    : "var(--orange)",
              animation: `sun-slice-load 950ms ease-in-out ${idx * 120}ms infinite`,
            }}
          />
        ))}
      </div>
      <span className="text-xs font-semibold tracking-wider uppercase text-[var(--text-dim)]">
        {label}
      </span>
    </div>
  );
}

export function SunSliceDivider() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-hidden="true">
      <span className="h-1 flex-1 rounded-full bg-[var(--line-muted)] opacity-50" />
      <span className="h-1 w-6 rounded-full bg-[var(--sun-yellow)]" />
      <span className="h-1 w-4 rounded-full bg-[var(--pink)]" />
      <span className="h-1 w-2.5 rounded-full bg-[var(--teal)]" />
    </div>
  );
}

export function SunSliceCountdownArc({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const r = 14;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - ratio);

  return (
    <div className="relative inline-flex items-center justify-center w-9 h-9 shrink-0">
      <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="var(--track)"
          strokeWidth="3.5"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={ratio < 0.25 ? "var(--pink)" : "var(--sun-yellow)"}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 250ms linear" }}
        />
      </svg>
      <span className="absolute text-[10px] font-extrabold neon-tabular text-[var(--text)]">
        {remaining}s
      </span>
    </div>
  );
}
