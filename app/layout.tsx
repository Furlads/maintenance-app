import "./globals.css";
import type { Metadata, Viewport } from "next";
import ServiceWorkerRegister from "@/app/components/ServiceWorkerRegister";
import GlobalAppPolish from "@/app/components/GlobalAppPolish";
import ThreeCountiesWorkerTheme from "@/app/components/ThreeCountiesWorkerTheme";

export const metadata: Metadata = {
  title: "Furlads Maintenance App",
  description: "Furlads internal system",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#18181b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <GlobalAppPolish />
        <ThreeCountiesWorkerTheme />
        {children}
      </body>
    </html>
  );
}
