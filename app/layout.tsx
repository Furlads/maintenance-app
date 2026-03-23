import "./globals.css";
import ServiceWorkerRegister from "@/app/components/ServiceWorkerRegister";

export const metadata = {
  title: "Furlads Maintenance App",
  description: "Furlads internal system",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
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
        {children}
      </body>
    </html>
  );
}