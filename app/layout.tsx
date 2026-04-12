import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aikagra Studio | Photography + Videography",
  description:
    "A cinematic photography and videography portfolio built from a v0 gallery template.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
