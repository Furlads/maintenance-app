// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import AppHeader from "./components/AppHeader";

export const metadata: Metadata = {
  title: "Maintenance Admin",
  description: "Furlads & Three Counties Property Care admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <AppHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}