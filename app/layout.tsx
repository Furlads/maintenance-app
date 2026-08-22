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

                function styleChasQuoteResults() {
                  if (window.location.pathname !== '/quote-test') return;

                  document.querySelectorAll('div.whitespace-pre-wrap').forEach(function (element) {
                    if (!(element instanceof HTMLElement)) return;
                    if (element.className.indexOf('bg-zinc-950') !== -1) return;
                    if (element.dataset.quoteReadable === '1') return;

                    var text = (element.textContent || '').trim();
                    if (!text) return;
                    if (text.indexOf('Price:') === -1 && text.indexOf('Total:') === -1) return;

                    var lines = text.split(/\n/);
                    element.textContent = '';
                    element.dataset.quoteReadable = '1';
                    element.style.maxWidth = '96%';
                    element.style.width = '100%';
                    element.style.fontSize = '15px';
                    element.style.lineHeight = '1.45';
                    element.style.padding = '14px';

                    var section = null;
                    var priceBox = null;

                    function newSection() {
                      var block = document.createElement('div');
                      block.style.padding = '12px 0';
                      block.style.borderBottom = '1px solid #e4e4e7';
                      element.appendChild(block);
                      section = block;
                      priceBox = null;
                      return block;
                    }

                    function currentSection() {
                      return section || newSection();
                    }

                    lines.forEach(function (rawLine) {
                      var line = rawLine.trim();
                      if (!line) return;

                      var isHeading = /^Option\s+/i.test(line) ||
                        /^Package\s+/i.test(line) ||
                        /^Combined/i.test(line) ||
                        /^All together/i.test(line) ||
                        (/^[A-Z][^:]{1,40}\s—\s/.test(line) && line.indexOf('£') === -1);

                      if (isHeading) {
                        if (section && section.childElementCount > 0) newSection();
                        var heading = document.createElement('div');
                        heading.textContent = line;
                        heading.style.fontSize = '18px';
                        heading.style.fontWeight = '900';
                        heading.style.lineHeight = '1.25';
                        heading.style.marginBottom = '7px';
                        currentSection().appendChild(heading);
                        return;
                      }

                      if (/^(Price|VAT|Total):/i.test(line)) {
                        if (!priceBox) {
                          priceBox = document.createElement('div');
                          priceBox.style.marginTop = '9px';
                          priceBox.style.borderRadius = '14px';
                          priceBox.style.background = '#f4f4f5';
                          priceBox.style.padding = '9px 11px';
                          currentSection().appendChild(priceBox);
                        }

                        var row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.justifyContent = 'space-between';
                        row.style.gap = '12px';
                        row.style.padding = '2px 0';

                        var parts = line.split(':');
                        var label = document.createElement('span');
                        label.textContent = parts.shift() || '';
                        label.style.fontWeight = '700';
                        label.style.color = '#71717a';

                        var value = document.createElement('span');
                        value.textContent = parts.join(':').trim();
                        value.style.fontWeight = line.toLowerCase().startsWith('total:') ? '900' : '800';
                        value.style.fontSize = line.toLowerCase().startsWith('total:') ? '17px' : '15px';
                        value.style.color = '#18181b';

                        row.appendChild(label);
                        row.appendChild(value);
                        priceBox.appendChild(row);
                        return;
                      }

                      var paragraph = document.createElement('div');
                      paragraph.textContent = line;

                      if (line.indexOf('•') === 0) {
                        paragraph.style.paddingLeft = '3px';
                        paragraph.style.marginTop = '4px';
                      } else if (/^Likely/i.test(line)) {
                        paragraph.style.marginTop = '9px';
                        paragraph.style.fontWeight = '800';
                        paragraph.style.color = '#3f3f46';
                      } else if (/^(Saving|Why it|Includes):/i.test(line)) {
                        paragraph.style.marginTop = '6px';
                        paragraph.style.fontWeight = '700';
                        paragraph.style.color = '#52525b';
                      } else if (/^If those prices/i.test(line)) {
                        paragraph.style.marginTop = '12px';
                        paragraph.style.borderRadius = '12px';
                        paragraph.style.background = '#fefce8';
                        paragraph.style.padding = '10px 12px';
                        paragraph.style.fontWeight = '800';
                        paragraph.style.color = '#713f12';
                      } else {
                        paragraph.style.marginTop = '5px';
                      }

                      currentSection().appendChild(paragraph);
                    });

                    if (section) section.style.borderBottom = 'none';
                  });
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

                  styleChasQuoteResults();
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

                function imageFromFile(file) {
                  return new Promise(function (resolve, reject) {
                    var url = URL.createObjectURL(file);
                    var image = new Image();
                    image.onload = function () {
                      URL.revokeObjectURL(url);
                      resolve(image);
                    };
                    image.onerror = function () {
                      URL.revokeObjectURL(url);
                      reject(new Error('Could not prepare photo'));
                    };
                    image.src = url;
                  });
                }

                function canvasToBlob(canvas, quality) {
                  return new Promise(function (resolve, reject) {
                    canvas.toBlob(function (blob) {
                      if (blob) resolve(blob);
                      else reject(new Error('Could not compress photo'));
                    }, 'image/jpeg', quality);
                  });
                }

                async function compressQuotePhoto(file) {
                  var MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
                  if (file.size <= MAX_UPLOAD_BYTES && /^image\\/(jpeg|jpg|png|webp)$/i.test(file.type || '')) {
                    return file;
                  }

                  try {
                    var image = await imageFromFile(file);
                    var maxSide = 2200;
                    var scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
                    var width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
                    var height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
                    var canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    var ctx = canvas.getContext('2d');
                    if (!ctx) return file;
                    ctx.drawImage(image, 0, 0, width, height);

                    var quality = 0.82;
                    var blob = await canvasToBlob(canvas, quality);
                    while (blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
                      quality -= 0.1;
                      blob = await canvasToBlob(canvas, quality);
                    }

                    var baseName = (file.name || 'site-photo').replace(/\\.[^.]+$/, '');
                    return new File([blob], baseName + '.jpg', {
                      type: 'image/jpeg',
                      lastModified: Date.now()
                    });
                  } catch (error) {
                    console.warn('Photo compression skipped:', error);
                    return file;
                  }
                }

                async function prepareQuotePhotos(event) {
                  if (window.location.pathname !== '/quote-test') return;
                  var input = event.target;
                  if (!(input instanceof HTMLInputElement)) return;
                  if (input.type !== 'file' || !(input.accept || '').includes('image')) return;

                  if (input.dataset.quotePhotosPrepared === '1') {
                    delete input.dataset.quotePhotosPrepared;
                    return;
                  }

                  var files = Array.from(input.files || []);
                  if (!files.length) return;

                  event.preventDefault();
                  event.stopImmediatePropagation();

                  try {
                    var prepared = [];
                    for (var i = 0; i < files.length; i += 1) {
                      prepared.push(await compressQuotePhoto(files[i]));
                    }

                    var transfer = new DataTransfer();
                    prepared.forEach(function (file) {
                      transfer.items.add(file);
                    });
                    input.files = transfer.files;
                    input.dataset.quotePhotosPrepared = '1';
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  } catch (error) {
                    console.warn('Photo preparation failed:', error);
                    input.dataset.quotePhotosPrepared = '1';
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }

                tidyQuotePhotoUi();

                var observer = new MutationObserver(tidyQuotePhotoUi);
                observer.observe(document.documentElement, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['capture']
                });

                document.addEventListener('change', prepareQuotePhotos, true);
                window.addEventListener('online', retrySavedQuotePhotos);
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
