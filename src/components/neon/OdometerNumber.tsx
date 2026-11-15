"use client";

import React, { useEffect, useRef, useState } from "react";

interface OdometerNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  format?: (val: number) => string;
  className?: string;
}

export function OdometerNumber({
  value,
  prefix = "",
  suffix = "",
  format,
  className = "",
}: OdometerNumberProps) {
  const prevRef = useRef(value);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (value !== prevRef.current) {
      setDirection(value > prevRef.current ? "up" : "down");
      setAnimKey((k) => k + 1);
      prevRef.current = value;
    }
  }, [value]);

  const formatted = format ? format(value) : value.toLocaleString("en-US");
  const display = `${prefix}${formatted}${suffix}`;

  return (
    <span className={`inline-flex overflow-hidden align-baseline neon-tabular ${className}`}>
      <span
        key={animKey}
        className={
          animKey === 0
            ? "inline-block"
            : direction === "up"
              ? "inline-block animate-odometer-up"
              : "inline-block animate-odometer-down"
        }
      >
        {display}
      </span>
    </span>
  );
}
