"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/**
 * A textarea as tall as its text: the whole description shows, with no empty space
 * left under it. It grows while typing and shrinks when text is removed.
 */
export function AutoGrowTextarea({
  minRows = 2,
  className,
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
    };
    fit();
    // The width changes with the window, and so does the number of lines.
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [props.value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      className={className}
      style={{ ...style, resize: "none", overflow: "hidden" }}
      {...props}
    />
  );
}
