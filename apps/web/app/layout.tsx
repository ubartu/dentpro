import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DENTRIVO — Clinic & Administration",
  description: "Clinic workflows and platform administration for DENTRIVO.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
