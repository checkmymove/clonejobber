import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job To Go — Business Operating System",
  description:
    "Job To Go: clients, requests, quotes, jobs and invoices for a London removals company.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
