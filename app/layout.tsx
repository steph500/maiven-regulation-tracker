import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Regulation Tracker | EPA Rules",
  description: "Search and review EPA rules from the U.S. Federal Register.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to regulations
        </a>
        {children}
      </body>
    </html>
  );
}
