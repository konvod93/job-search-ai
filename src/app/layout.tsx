import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobSearch AI",
  description: "Платформа пошуку роботи з AI-помічником",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
