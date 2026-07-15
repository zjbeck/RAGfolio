import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import corpusConfig from "@config";
import { copy } from "@/copy";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: copy.siteName,
  description: copy.seo.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={corpusConfig.lang}
      // The no-FOUC script sets data-mode / data-palette on <html> before
      // React hydrates, so the client attributes won't match the server HTML.
      // This is the sanctioned use of suppressHydrationWarning (scoped to this
      // element's own attributes, not its subtree).
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        {/* No-FOUC: set data-mode / data-palette before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
