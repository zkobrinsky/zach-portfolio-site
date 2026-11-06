import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Mono } from "next/font/google";
import { HOME_TITLE, PAGES, PERSON_SCHEMA, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

// Next has no sizing data for Big Shoulders, so a named fallback avoids its "font override values" warning
const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin"], weight: "900", fallback: ["Impact", "sans-serif"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: `%s | ${SITE_NAME}` },
  description: PAGES["/"].description,
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_SCHEMA) }} />
        {children}
      </body>
    </html>
  );
}
