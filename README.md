# SignalLift — private MVP

A private working build for three brand projects, real one-page readiness audits, evidence-backed action plans, buyer questions, manually recorded AI answers, and printable agency-branded reports. See SRS.md for the sellable MVP scope and launch gates.

## Stack
Vinext / React / TypeScript, Cloudflare Workers, D1 + Drizzle, Sites-managed ChatGPT identity. Use Node >=22.13; the build is being verified with Node 24. No paid data provider or billing credentials are bundled.

## Development
Install through the Sites install-dependencies.mjs helper (or npm run install:ci). Run npm run db:generate after schema changes. Build with the Sites build-site.mjs helper, then apply generated migrations locally using the D1 command in the starter skill. Start npm run dev. The portable starter simulates sign-in only for localhost; production uses Sites identity.

## Checks
Run node --experimental-strip-types --test tests/audit.test.mjs and node node_modules/typescript/bin/tsc --noEmit. Build through the Sites helper.

## What works
Authenticated user isolation; database persistence; 3-brand / 20-question limits; 10 scan attempts per UTC day with per-brand cooldown; bounded HTTPS fetching with public DNS and redirect checks; six fixed readiness checks; rescan history; task tracking; manual observations labelled with source/time/locale; report printing and JSON evidence export; deletion.

## Measurement limits
Audits check the initial HTML of one URL without executing JavaScript. Unknown robots checks suppress the aggregate score. Scores are our checklist, not citation probabilities. Tasks never change scores. AI observations are manually supplied, not platform-verified or representative of customer traffic. Competitors are saved context; automatic comparative visibility is not implemented. No synthetic customer metrics are preloaded.

## Launch gates
Before charging users: integrate and validate live ChatGPT/Gemini collection, scheduled weekly runs, payments/cancellation/webhooks, plan entitlements, appropriate customer authentication, account deletion/export, provider terms, operational monitoring, and billing/data-provider cost tests. The current private build is not a completed paid SaaS.

## Security notes
Records are keyed to the authenticated Site user; every mutation checks ownership and request origin. Never trust submitted owner IDs. Secrets must remain server-side. The crawler accepts public HTTPS domains only, rejects unsafe DNS targets, bounds redirects/time/body size, and forwards no session or provider credentials. Deployment egress protections remain important against DNS rebinding; do not attach this crawler to internal networks.
