16:36:27.273 Running build in Washington, D.C., USA (East) – iad1
16:36:27.274 Build machine configuration: 2 cores, 8 GB
16:36:27.401 Cloning github.com/Furlads/maintenance-app (Branch: main, Commit: 1ba3648)
16:36:28.361 Cloning completed: 959.000ms
16:36:28.988 Restored build cache from previous deployment (9REeqyPhdPxMSCaeYsvkC4V7ztnW)
16:36:29.439 Running "vercel build"
16:36:30.052 Vercel CLI 50.34.2
16:36:30.305 Installing dependencies...
16:36:31.517 
16:36:31.517 > maintenance-app@1.0.0 postinstall
16:36:31.518 > prisma generate
16:36:31.518 
16:36:32.524 Prisma schema loaded from prisma/schema.prisma
16:36:32.905 
16:36:32.905 ✔ Generated Prisma Client (v6.19.2) to ./node_modules/@prisma/client in 198ms
16:36:32.906 
16:36:32.906 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
16:36:32.906 
16:36:32.906 Tip: Need your database queries to be 1000x faster? Accelerate offers you that and more: https://pris.ly/tip-2-accelerate
16:36:32.906 
16:36:32.925 
16:36:32.926 added 3 packages in 2s
16:36:32.926 
16:36:32.926 46 packages are looking for funding
16:36:32.927   run `npm fund` for details
16:36:32.955 Detected Next.js version: 14.2.5
16:36:32.955 Running "npx prisma generate && next build"
16:36:33.965 Prisma schema loaded from prisma/schema.prisma
16:36:34.285 ┌─────────────────────────────────────────────────────────┐
16:36:34.286 │  Update available 6.19.2 -> 7.5.0                       │
16:36:34.286 │                                                         │
16:36:34.286 │  This is a major update - please follow the guide at    │
16:36:34.286 │  https://pris.ly/d/major-version-upgrade                │
16:36:34.287 │                                                         │
16:36:34.287 │  Run the following to update                            │
16:36:34.287 │    npm i --save-dev prisma@latest                       │
16:36:34.287 │    npm i @prisma/client@latest                          │
16:36:34.287 └─────────────────────────────────────────────────────────┘
16:36:34.288 
16:36:34.288 ✔ Generated Prisma Client (v6.19.2) to ./node_modules/@prisma/client in 142ms
16:36:34.288 
16:36:34.288 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
16:36:34.289 
16:36:34.289 Tip: Interested in query caching in just a few lines of code? Try Accelerate today! https://pris.ly/tip-3-accelerate
16:36:34.289 
16:36:34.962   ▲ Next.js 14.2.5
16:36:34.963 
16:36:34.988    Creating an optimized production build ...
16:36:47.813  ✓ Compiled successfully
16:36:47.814    Linting and checking validity of types ...
16:36:57.658    Collecting page data ...
16:36:59.480    Generating static pages (0/82) ...
16:37:00.587 OUTLOOK CALLBACK ROUTE ERROR: q [Error]: Dynamic server usage: Route /api/inbox/outlook/callback couldn't be rendered statically because it used `request.url`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
16:37:00.588     at W (/vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21106)
16:37:00.588     at Object.get (/vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:28459)
16:37:00.588     at u (/vercel/path0/.next/server/app/api/inbox/outlook/callback/route.js:1:598)
16:37:00.588     at /vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:36264
16:37:00.588     at /vercel/path0/node_modules/next/dist/server/lib/trace/tracer.js:140:36
16:37:00.588     at NoopContextManager.with (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
16:37:00.589     at ContextAPI.with (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518)
16:37:00.589     at NoopTracer.startActiveSpan (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18093)
16:37:00.589     at ProxyTracer.startActiveSpan (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18854)
16:37:00.589     at /vercel/path0/node_modules/next/dist/server/lib/trace/tracer.js:122:103 {
16:37:00.589   description: "Route /api/inbox/outlook/callback couldn't be rendered statically because it used `request.url`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
16:37:00.589   digest: 'DYNAMIC_SERVER_USAGE'
16:37:00.589 }
16:37:00.589    Generating static pages (20/82) 
16:37:06.727 GET /api/schedule/day failed q [Error]: Dynamic server usage: Route /api/schedule/day couldn't be rendered statically because it used `nextUrl.searchParams`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
16:37:06.729     at W (/vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21106)
16:37:06.729     at Object.get (/vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:28131)
16:37:06.729     at l (/vercel/path0/.next/server/app/api/schedule/day/route.js:1:701)
16:37:06.731     at /vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:36264
16:37:06.731     at /vercel/path0/node_modules/next/dist/server/lib/trace/tracer.js:140:36
16:37:06.731     at NoopContextManager.with (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
16:37:06.731     at ContextAPI.with (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518)
16:37:06.731     at NoopTracer.startActiveSpan (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18093)
16:37:06.731     at ProxyTracer.startActiveSpan (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18854)
16:37:06.731     at /vercel/path0/node_modules/next/dist/server/lib/trace/tracer.js:122:103 {
16:37:06.732   description: "Route /api/schedule/day couldn't be rendered statically because it used `nextUrl.searchParams`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
16:37:06.732   digest: 'DYNAMIC_SERVER_USAGE'
16:37:06.732 }
16:37:06.996    Generating static pages (40/82) 
16:37:07.043  ⨯ useSearchParams() should be wrapped in a suspense boundary at page "/admin/reset-password". Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
16:37:07.044     at o (/vercel/path0/.next/server/chunks/4471.js:1:10524)
16:37:07.044     at d (/vercel/path0/.next/server/chunks/4471.js:1:21430)
16:37:07.044     at o (/vercel/path0/.next/server/app/admin/reset-password/page.js:1:6559)
16:37:07.044     at nj (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:46251)
16:37:07.044     at nM (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:47571)
16:37:07.045     at nN (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:64546)
16:37:07.045     at nI (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:47010)
16:37:07.045     at nM (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:47717)
16:37:07.045     at nM (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:61546)
16:37:07.045     at nN (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:12:64546)
16:37:07.045 
16:37:07.045 Error occurred prerendering page "/admin/reset-password". Read more: https://nextjs.org/docs/messages/prerender-error
16:37:07.045 
16:37:07.250    Generating static pages (61/82) 
16:37:07.966 GET /api/chas/messages failed: q [Error]: Dynamic server usage: Route /api/chas/messages couldn't be rendered statically because it used `request.url`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
16:37:07.967     at W (/vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21106)
16:37:07.967     at Object.get (/vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:28459)
16:37:07.967     at l (/vercel/path0/.next/server/app/api/chas/messages/route.js:1:634)
16:37:07.967     at /vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:36264
16:37:07.967     at /vercel/path0/node_modules/next/dist/server/lib/trace/tracer.js:140:36
16:37:07.967     at NoopContextManager.with (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
16:37:07.967     at ContextAPI.with (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518)
16:37:07.967     at NoopTracer.startActiveSpan (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18093)
16:37:07.968     at ProxyTracer.startActiveSpan (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18854)
16:37:07.968     at /vercel/path0/node_modules/next/dist/server/lib/trace/tracer.js:122:103 {
16:37:07.968   description: "Route /api/chas/messages couldn't be rendered statically because it used `request.url`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
16:37:07.968   digest: 'DYNAMIC_SERVER_USAGE'
16:37:07.968 }
16:37:07.970 GET /api/chas/thread failed: q [Error]: Dynamic server usage: Route /api/chas/thread couldn't be rendered statically because it used `request.url`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
16:37:07.970     at W (/vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21106)
16:37:07.970     at Object.get (/vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:28459)
16:37:07.970     at c (/vercel/path0/.next/server/app/api/chas/thread/route.js:1:623)
16:37:07.970     at /vercel/path0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:36264
16:37:07.970     at /vercel/path0/node_modules/next/dist/server/lib/trace/tracer.js:140:36
16:37:07.971     at NoopContextManager.with (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
16:37:07.971     at ContextAPI.with (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518)
16:37:07.971     at NoopTracer.startActiveSpan (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18093)
16:37:07.971     at ProxyTracer.startActiveSpan (/vercel/path0/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:18854)
16:37:07.971     at /vercel/path0/node_modules/next/dist/server/lib/trace/tracer.js:122:103 {
16:37:07.972   description: "Route /api/chas/thread couldn't be rendered statically because it used `request.url`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
16:37:07.972   digest: 'DYNAMIC_SERVER_USAGE'
16:37:07.972 }
16:37:08.045  ✓ Generating static pages (82/82)
16:37:08.047 
16:37:08.047 > Export encountered errors on following paths:
16:37:08.047 	/admin/reset-password/page: /admin/reset-password
16:37:08.083 Error: Command "npx prisma generate && next build" exited with 1