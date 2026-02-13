import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "RailAgent | Developer-first remittance infrastructure",
  description:
    "RailAgent helps AI agents move value cross-border with policy controls, optimized routing, and signed settlement webhooks."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
