import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentinel dashboard",
  description: "Dashboard dinamica per i monitor Sentinel"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
