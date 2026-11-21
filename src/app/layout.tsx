import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Capture the Narrative",
  description: "Test your post on 1,000 AI agents before you publish.",
};
// viewportFit "cover" lets the fixed bottom nav sit over the iOS home-indicator area; it pads itself with env(safe-area-inset-bottom).
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#000000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
