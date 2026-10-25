import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventario de Sistemas · SUDEASEG",
  description: "Captura estructurada y seguimiento del relevamiento de sistemas e indicadores de gestión.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
