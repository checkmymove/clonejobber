"use client";

import type { MouseEvent } from "react";

// Native date inputs only open their calendar from the small icon; open it from
// anywhere in the box instead.
export function openPicker(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  if (input.disabled || input.readOnly) return;
  try {
    input.showPicker?.();
  } catch {
    input.focus();
  }
}
