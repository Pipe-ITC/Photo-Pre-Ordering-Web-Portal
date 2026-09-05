# Application Server gallery delivery

This portal remains a separate repository from the EventPhoto Application Server. Its source branch is `codex/gallery-ordering`; the Windows Sales Client is not part of this delivery.

## Source phases completed

1. Neon schema and migration for event galleries, album hierarchy, private-image metadata, signed-sync replay records, product mappings and normalized order/image selections.
2. HMAC-authenticated v1 sync routes for staged manifests, private Vercel Blob uploads, activation, archival, product mappings, paid-order export and fulfilment acknowledgement.
3. Event-scoped public routes that show album hierarchy, watermarked thumbnails and filenames, with checkout using gallery image UUIDs rather than typed values.
4. Manual and scheduled ordering closure, event/album archival, retained reporting records and retryable Blob deletion.
5. Friendly archived-link handling: “Orders are no longer being accepted for this event.”

## Verification phase not started

- Generate Prisma Client and apply the migration to an isolated Neon branch.
- Run lint/build and automated suites.
- Verify Stripe webhook-to-order export, signed-request replay, interrupted/retried Blob sync, activation ordering, archived-link refresh, cutoff boundaries and fulfilment round trips.
- Perform responsive, accessibility and private-image browser checks.

## Deployment phase not started

- Provision private Vercel Blob and current/next sync credentials.
- Apply the production Neon migration and configure Vercel environment variables.
- Deploy and validate `https://festivalphotos.pipeitc.dev` with a disposable event before enabling a live event.

No database, Vercel, Blob, Stripe or domain change has been made by the repository-only phase.
