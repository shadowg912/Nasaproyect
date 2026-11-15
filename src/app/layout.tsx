import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/nav/AppShell";

export const metadata: Metadata = {
  title: "Satflame — Monitoreo de incendios con datos de la NASA",
  description: "Detecciones satelitales de incendios de NASA FIRMS para República Dominicana, procesadas localmente.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#01335f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
