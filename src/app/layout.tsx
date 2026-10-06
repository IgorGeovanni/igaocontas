import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { ValueVisibilityProvider } from "@/components/ValueVisibilityContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });

export const metadata: Metadata = {
  title: "IGÃO CONTAS",
  description: "Controle financeiro pessoal — simples, rápido e direto ao ponto.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0B0B0E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen bg-base-bg font-body text-ink-primary antialiased">
        <ValueVisibilityProvider>{children}</ValueVisibilityProvider>
      </body>
    </html>
  );
}
