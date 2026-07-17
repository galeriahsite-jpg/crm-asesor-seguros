import type { Metadata } from "next";
import "./globals.css";
import LumoCapture from "./components/LumoCapture";

export const metadata: Metadata = {
  title: "LUMO · CRM Asesor de Seguros",
  description: "Tu cuaderno. Tu diario. Tus recordatorios. Tu foco.",
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
      </body>
    </html>
  );
}
