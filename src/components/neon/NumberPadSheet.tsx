"use client";

import React, { useEffect, useState } from "react";
import { Delete, X } from "lucide-react";
import { ViewfinderBrackets } from "./ViewfinderBrackets";

interface NumberPadSheetProps {
  open: boolean;
  title: string;
  initialValue: number;
  maxValue?: number;
  onClose: () => void;
  onApply: (nextValue: number) => void;
}

export function NumberPadSheet({
  open,
  title,
  initialValue,
  maxValue,
  onClose,
  onApply,
}: NumberPadSheetProps) {
  const [digits, setDigits] = useState(String(initialValue));

  useEffect(() => {
    if (open) {
      setDigits(String(initialValue));
    }
  }, [open, initialValue]);

  if (!open) return null;

  const pushDigit = (d: string) => {
    setDigits((prev) => {
      const next = prev === "0" ? d : `${prev}${d}`;
      const num = Number(next);
      if (maxValue !== undefined && num > maxValue) return String(maxValue);
      return next.slice(0, 9);
    });
  };

  const handleBackspace = () => {
    setDigits((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
  };

  const handleSubmit = () => {
    const parsed = Math.max(0, Number(digits) || 0);
    onApply(maxValue !== undefined ? Math.min(maxValue, parsed) : parsed);
    onClose();
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#11072B]/80 backdrop-blur-sm p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${title}`}
    >
      <div
        className="relative w-full max-w-sm bg-[var(--bg-deep)] border border-[var(--teal)]/45 p-5 space-y-4 neon-glow-teal animate-tab-in"
        style={{ borderRadius: "var(--radius-sheet)" }}
      >
        <ViewfinderBrackets size={16} thickness={2.5} offset={10} />

        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--teal)]">
              Exact Value Entry
            </div>
            <h3 className="neon-display text-xl text-[var(--text)]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close number pad"
            className="w-11 h-11 rounded-xl bg-[var(--track)]/70 hover:bg-[var(--track)] flex items-center justify-center text-[var(--text)] neon-focus"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--bg-night)] border border-[var(--line-muted)]/50 px-4 py-3 text-right">
          <span className="neon-display text-4xl text-[var(--text)] neon-tabular">
            {Number(digits || 0).toLocaleString("en-US")}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pushDigit(k)}
              className="h-14 rounded-xl bg-[var(--track)]/60 hover:bg-[var(--track)] active:scale-95 text-lg font-extrabold text-[var(--text)] transition-transform neon-focus"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDigits("0")}
            className="h-14 rounded-xl bg-[var(--track)]/40 hover:bg-[var(--track)] text-xs font-extrabold uppercase tracking-wider text-[var(--text-dim)] neon-focus"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => pushDigit("0")}
            className="h-14 rounded-xl bg-[var(--track)]/60 hover:bg-[var(--track)] active:scale-95 text-lg font-extrabold text-[var(--text)] transition-transform neon-focus"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            className="h-14 rounded-xl bg-[var(--track)]/40 hover:bg-[var(--track)] flex items-center justify-center text-[var(--text-dim)] neon-focus"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="w-full h-14 rounded-2xl bg-[var(--pink)] hover:opacity-95 active:scale-[0.98] text-[var(--text)] font-extrabold text-base tracking-wide transition-transform neon-glow-pink neon-focus"
        >
          Apply {title}
        </button>
      </div>
    </div>
  );
}
