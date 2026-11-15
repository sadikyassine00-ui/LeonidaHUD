"use client";

import React from "react";

interface ViewfinderBracketsProps {
  color?: string;
  size?: number;
  thickness?: number;
  offset?: number;
  animateLock?: boolean;
  className?: string;
}

export function ViewfinderBrackets({
  color = "var(--teal)",
  size = 14,
  thickness = 2.5,
  offset = 0,
  animateLock = true,
  className = "",
}: ViewfinderBracketsProps) {
  const pos = `${offset}px`;
  const styleCorner = (
    top: boolean,
    left: boolean
  ): React.CSSProperties => ({
    position: "absolute",
    width: `${size}px`,
    height: `${size}px`,
    top: top ? pos : undefined,
    bottom: !top ? pos : undefined,
    left: left ? pos : undefined,
    right: !left ? pos : undefined,
    borderColor: color,
    borderTopWidth: top ? `${thickness}px` : 0,
    borderBottomWidth: !top ? `${thickness}px` : 0,
    borderLeftWidth: left ? `${thickness}px` : 0,
    borderRightWidth: !left ? `${thickness}px` : 0,
    borderStyle: "solid",
    pointerEvents: "none",
    filter: `drop-shadow(0 0 6px ${color})`,
  });

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${
        animateLock ? "animate-bracket-lock" : ""
      } ${className}`}
    >
      <span style={styleCorner(true, true)} />
      <span style={styleCorner(true, false)} />
      <span style={styleCorner(false, true)} />
      <span style={styleCorner(false, false)} />
    </div>
  );
}
