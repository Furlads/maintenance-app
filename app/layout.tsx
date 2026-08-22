import "./globals.css";
import type { Metadata, Viewport } from "next";
import ServiceWorkerRegister from "@/app/components/ServiceWorkerRegister";
import GlobalAppPolish from "@/app/components/GlobalAppPolish";

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
        {children}
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `eruda.init();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                function isQuoteVisit() {
                  return window.location.pathname.startsWith('/trev/quote/') ||
                    window.location.pathname === '/quote-test';
                }

                function tidyQuotePhotoUi() {
                  if (!isQuoteVisit()) return;

                  document
                    .querySelectorAll('input[type="file"][accept*="image"]')
                    .forEach(function (input) {
                      input.removeAttribute('capture');
                    });

                  document.querySelectorAll('div').forEach(function (element) {
                    if (element.childElementCount !== 0) return;
                    if ((element.textContent || '').trim() === 'Retry on reopen') {
                      element.textContent = 'Saved — will upload';
                    }
                  });
                }

                function hasSavedPhotosWaiting() {
                  return Array.from(document.querySelectorAll('div')).some(function (element) {
                    var text = (element.textContent || '').trim();
                    return text === 'Saved — will upload' || text === 'Retry on reopen';
                  });
                }

                function retrySavedQuotePhotos() {
                  if (!isQuoteVisit()) return;
                  if (!navigator.onLine) return;
                  if (!hasSavedPhotosWaiting()) return;
                  window.location.reload();
                }

                tidyQuotePhotoUi();

                var observer = new MutationObserver(tidyQuotePhotoUi);
                observer.observe(document.documentElement, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['capture']
                });

                window.addEventListener('online', retrySavedQuotePhotos);
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
