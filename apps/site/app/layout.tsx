import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-dm-sans" });
const manrope = Manrope({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Dentrivo | Diş tedavisi kararında daha fazla netlik",
  description:
    "Dentrivo, kliniklerin hazırladığı tedavi planlarını ve fiyat tekliflerini aynı yapıda görmeyi, anlamayı ve karşılaştırmayı kolaylaştırır.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={`${dmSans.variable} ${manrope.variable}`}>{children}</body>
    </html>
  );
}
