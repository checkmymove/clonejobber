"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies `text` to the clipboard; the icon turns into a tick for a moment. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (insecure origin or denied): nothing to undo.
        }
      }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink"
    >
      {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
    </button>
  );
}
