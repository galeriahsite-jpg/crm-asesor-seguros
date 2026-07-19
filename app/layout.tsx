import type { Metadata, Viewport } from "next";
import "./globals.css";
import LumoCapture from "./components/LumoCapture";
import { NotificacionesLumo } from "./components/Notificaciones";

export const metadata: Metadata = {
  title: "LUMO · CRM Asesor de Seguros",
  description: "Tu cuaderno. Tu diario. Tus recordatorios. Tu foco.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LUMO",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // respeta el notch y el home indicator del iPhone
  themeColor: "#0D0D0D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <LumoCapture />
        <NotificacionesLumo />
      </body>
    </html>
  );
}
