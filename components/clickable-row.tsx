"use client";

import { useRouter } from "next/navigation";

// Whole-row navigation for list tables: the row highlights on hover and a click
// anywhere on it opens `href`. Inner links/buttons keep their own behaviour.
export function ClickableRow({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("a,button,input,select,textarea")) return;
        router.push(href);
      }}
      className={`cursor-pointer border-b border-line last:border-0 hover:bg-[#f7f8f8] ${className}`}
    >
      {children}
    </tr>
  );
}
