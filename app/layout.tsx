import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { APP_NAME, TAGLINE } from "@/lib/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — ${TAGLINE}`,
  description:
    "Create a room, share your starting point and preferences, discover venues that work for the whole group, and vote on the final meetup spot. Open-source, built on OpenStreetMap data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
