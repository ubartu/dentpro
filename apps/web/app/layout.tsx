import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DENTRIVO — Klinik ve Yönetim",
  description: "DENTRIVO klinik işlemleri ve platform yönetimi.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
