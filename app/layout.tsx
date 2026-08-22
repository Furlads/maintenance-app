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

                function setReactInputValue(element, value) {
                  var prototype = element instanceof HTMLTextAreaElement
                    ? window.HTMLTextAreaElement.prototype
                    : window.HTMLInputElement.prototype;
                  var descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
                  if (descriptor && descriptor.set) descriptor.set.call(element, value);
                  else element.value = value;
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                }

                function getQuoteCustomerFromHeader() {
                  var header = document.querySelector('header');
                  if (!header) return null;
                  var buttons = Array.from(header.querySelectorAll('button'));
                  var customerButton = buttons.find(function (button) {
                    return (button.textContent || '').indexOf(' · ') !== -1;
                  });
                  if (!customerButton) return null;
                  var parts = (customerButton.textContent || '').trim().split(' · ');
                  return {
                    name: parts[0] || '',
                    postcode: parts.slice(1).join(' · ') || ''
                  };
                }

                function getQuoteTranscript() {
                  return Array.from(document.querySelectorAll('div.whitespace-pre-wrap'))
                    .map(function (element) { return (element.textContent || '').trim(); })
                    .filter(Boolean)
                    .join('\n\n');
                }

                function getReadyPhotoNames() {
                  return Array.from(document.querySelectorAll('img[alt]'))
                    .filter(function (image) {
                      var wrapper = image.parentElement;
                      return wrapper && (wrapper.textContent || '').indexOf('Ready') !== -1;
                    })
                    .map(function (image) { return image.getAttribute('alt') || ''; })
                    .filter(Boolean);
                }

                var draftSaveTimer = null;
                var creatingDraft = false;

                async function saveChasDraft() {
                  if (window.location.pathname !== '/quote-test') return;
                  var customer = getQuoteCustomerFromHeader();
                  if (!customer || !customer.name) return;

                  var transcript = getQuoteTranscript();
                  var photoNames = getReadyPhotoNames();
                  if (!transcript && !photoNames.length) return;

                  var storedId = Number(localStorage.getItem('chasActiveDraftId') || '0');
                  var payload = {
                    customerName: customer.name,
                    customerPostcode: customer.postcode,
                    scope: transcript.split('\n\n').filter(Boolean).slice(-2, -1)[0] || ('Quote in progress for ' + customer.name),
                    quoteWorking: JSON.stringify({
                      version: 1,
                      transcript: transcript,
                      photoNames: photoNames,
                      savedAt: new Date().toISOString()
                    }),
                    status: 'in_progress'
                  };

                  try {
                    if (storedId > 0) {
                      var patch = await fetch('/api/quotes/' + storedId, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      if (patch.ok) return;
                      localStorage.removeItem('chasActiveDraftId');
                    }

                    if (creatingDraft) return;
                    creatingDraft = true;
                    var created = await fetch('/api/quotes', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    var data = await created.json().catch(function () { return null; });
                    if (created.ok && data && data.quote && data.quote.id) {
                      localStorage.setItem('chasActiveDraftId', String(data.quote.id));
                    }
                  } catch (error) {
                    console.warn('Could not autosave quote draft:', error);
                  } finally {
                    creatingDraft = false;
                  }
                }

                function queueChasDraftSave() {
                  if (window.location.pathname !== '/quote-test') return;
                  if (draftSaveTimer) clearTimeout(draftSaveTimer);
                  draftSaveTimer = setTimeout(saveChasDraft, 1200);
                }

                async function closeSavedDraftIfSent() {
                  if (window.location.pathname !== '/quote-test') return;
                  var sent = Array.from(document.querySelectorAll('div')).some(function (element) {
                    return (element.textContent || '').trim() === 'Sent to Kelly for review ✓';
                  });
                  if (!sent) return;
                  var id = Number(localStorage.getItem('chasActiveDraftId') || '0');
                  if (!id) return;
                  try {
                    await fetch('/api/quotes/' + id, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'archived' })
                    });
                  } catch (error) {}
                  localStorage.removeItem('chasActiveDraftId');
                }

                async function resumeDraftIfRequested() {
                  if (window.location.pathname !== '/quote-test') return;
                  var params = new URLSearchParams(window.location.search);
                  var draftId = Number(params.get('draft') || '0');
                  if (!draftId) return;
                  if (document.documentElement.dataset.draftResumeStarted === '1') return;
                  document.documentElement.dataset.draftResumeStarted = '1';

                  try {
                    var response = await fetch('/api/quotes/' + draftId, { cache: 'no-store' });
                    var data = await response.json().catch(function () { return null; });
                    if (!response.ok || !data || !data.quote) return;
                    var quote = data.quote;
                    localStorage.setItem('chasActiveDraftId', String(draftId));

                    var waitForForm = setInterval(function () {
                      var nameInput = document.querySelector('input[placeholder="Customer name"]');
                      var phoneInput = document.querySelector('input[placeholder="07…"]');
                      var postcodeInput = document.querySelector('input[placeholder="TF9 4BQ"]');
                      var addressInput = document.querySelector('input[placeholder="Optional address"]');
                      var emailInput = document.querySelector('input[placeholder="Optional email"]');
                      if (!nameInput || !phoneInput || !postcodeInput) return;
                      clearInterval(waitForForm);
                      setReactInputValue(nameInput, quote.customerName || (quote.customer && quote.customer.name) || '');
                      setReactInputValue(phoneInput, quote.customerPhone || (quote.customer && quote.customer.phone) || '');
                      setReactInputValue(postcodeInput, quote.customerPostcode || (quote.customer && quote.customer.postcode) || '');
                      if (addressInput) setReactInputValue(addressInput, quote.customerAddress || (quote.customer && quote.customer.address) || '');
                      if (emailInput) setReactInputValue(emailInput, quote.customerEmail || (quote.customer && quote.customer.email) || '');

                      var startButton = Array.from(document.querySelectorAll('button')).find(function (button) {
                        return (button.textContent || '').indexOf('start quote with CHAS') !== -1;
                      });
                      if (startButton) startButton.click();

                      var waitForComposer = setInterval(function () {
                        var textarea = document.querySelector('textarea[placeholder="Tell Chas about the job…"]');
                        if (!textarea) return;
                        clearInterval(waitForComposer);
                        var working = '';
                        try {
                          var parsed = JSON.parse(quote.quoteWorking || '{}');
                          working = parsed.transcript || '';
                        } catch (error) {
                          working = quote.quoteWorking || '';
                        }
                        if (!working) return;
                        setReactInputValue(textarea, 'Continue this in-progress quote from the saved work below. Keep everything already agreed unless I change it.\n\n' + working);

                        var banner = document.createElement('div');
                        banner.textContent = 'Draft restored ✓  Your previous quote working has been loaded into the message box. Add anything new, then press the arrow to continue with Chas.';
                        banner.style.margin = '0 auto 10px';
                        banner.style.maxWidth = '720px';
                        banner.style.border = '1px solid #86efac';
                        banner.style.background = '#f0fdf4';
                        banner.style.color = '#166534';
                        banner.style.borderRadius = '14px';
                        banner.style.padding = '10px 12px';
                        banner.style.fontSize = '13px';
                        banner.style.fontWeight = '800';
                        var footer = textarea.closest('footer');
                        var container = footer && footer.firstElementChild;
                        if (container) container.insertBefore(banner, container.firstChild);
                      }, 250);
                    }, 250);
                  } catch (error) {
                    console.warn('Could not resume quote draft:', error);
                  }
                }

                tidyQuotePhotoUi();
                resumeDraftIfRequested();

                var observer = new MutationObserver(function () {
                  tidyQuotePhotoUi();
                  queueChasDraftSave();
                  closeSavedDraftIfSent();
                  resumeDraftIfRequested();
                });
                observer.observe(document.documentElement, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['capture']
                });

                document.addEventListener('change', prepareQuotePhotos, true);
                window.addEventListener('online', retrySavedQuotePhotos);
                window.addEventListener('pagehide', function () { void saveChasDraft(); });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
