import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opero — Business Operating System",
  description:
    "Opero: gestão de empresas de serviços — clientes, solicitações, cotações, serviços e faturas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
