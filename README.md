# Photeam Festival Order Portal

A production-ready Next.js order and collection portal for football festivals.
Customers select one of five fixed photo products, enter the required image IDs, and
pay through Stripe Checkout. Staff manage paid orders from a protected admin board,
with notifications delivered through Mailgun.

## Production architecture

- Next.js application and API routes
- PostgreSQL database through Prisma
- Stripe Checkout with signed webhooks
- Mailgun transactional email
- HTTP Basic Authentication for the admin area
- Prisma migrations applied during deployment
- `/api/health` database health check
- Vercel configuration and a standalone Docker image

SQLite is no longer used. Production and local development both require PostgreSQL.
Good managed options include Neon, Supabase, Railway, Render, and AWS RDS.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and replace every placeholder.

3. Create the PostgreSQL schema:

   ```bash
   npm run db:deploy
   ```

4. Start the application:

   ```bash
   npm run dev
   ```

5. Forward Stripe test webhooks:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   Put the resulting `whsec_...` value in `STRIPE_WEBHOOK_SECRET`.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_SITE_URL` | Public HTTPS origin, without a trailing path |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the production webhook |
| `PRICE_*` | Product prices in pence |
| `ADMIN_USERNAME` | Admin dashboard username |
| `ADMIN_PASSWORD` | Unique password of at least 16 characters |
| `ADMIN_EMAIL` | Recipient for paid-order alerts |
| `MAILGUN_API_KEY` | Private Mailgun API key |
| `MAILGUN_DOMAIN` | Verified Mailgun sending domain |
| `MAILGUN_FROM` | Sender name and address |
| `MAILGUN_REGION` | `EU` or `US`, matching the Mailgun domain |
| `NEXT_PUBLIC_FESTIVAL_NAME` | Festival name shown to customers |
| `NEXT_PUBLIC_COLLECTION_POINT` | Collection location used in customer emails |

Validate a configured production environment before deploying:

```bash
npm run deploy:check
```

Product prices are integers in pence. For example,
`PRICE_MEDIUM_PRINT="1000"` means £10.00.

## Vercel deployment

The included `vercel.json` runs validation, applies pending Prisma migrations, and
builds the Next.js application.

1. Create a managed PostgreSQL database in the same region as the application.
2. Import the GitHub repository into Vercel.
3. Add every variable from `.env.example` to the Production environment.
4. Deploy the project.
5. Confirm `https://your-domain/api/health` returns HTTP 200.
6. Attach the production domain and update `NEXT_PUBLIC_SITE_URL` to its exact HTTPS
   origin.
7. Redeploy after changing `NEXT_PUBLIC_SITE_URL`.

For PostgreSQL providers that offer pooled and direct URLs, use a connection string
that supports Prisma migrations during the build. Follow that provider's Prisma
guidance for SSL and connection pooling.

## Docker deployment

Build the image:

```bash
docker build -t photeam-festival-orders .
```

Run it with production environment variables:

```bash
docker run --env-file .env.production -p 3000:3000 photeam-festival-orders
```

The container applies pending migrations before starting the server. The hosting
platform should route HTTPS traffic to port `3000` and use `/api/health` as its health
check.

## Stripe production setup

1. Activate the Stripe account and replace test keys with live keys.
2. In Stripe Workbench, create a webhook endpoint:

   ```text
   https://orders.photeam.co.uk/api/stripe/webhook
   ```

3. Subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
4. Put that endpoint's live `whsec_...` signing secret in
   `STRIPE_WEBHOOK_SECRET`.
5. Make a low-value live order and confirm payment, the admin email, and the order in
   `/admin`.

The webhook is the authoritative payment record and safely ignores duplicate
successful events. The success page also securely retrieves the Checkout Session
from Stripe and reconciles a paid order as a fallback, but this does not replace the
production webhook because customers may close Stripe before returning to the site.

If a completed Stripe payment remains pending in the database:

1. Open Stripe Workbench and inspect the webhook endpoint's event deliveries.
2. Confirm the endpoint URL exactly matches the active production domain.
3. Confirm the endpoint and `STRIPE_SECRET_KEY` are both in the same Stripe mode
   (test or live).
4. Copy that endpoint's signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`.
5. Redeploy after changing Vercel environment variables.
6. Use Stripe's **Resend** action on the failed `checkout.session.completed` event.

## Mailgun production setup

1. Add and verify the Mailgun sending domain.
2. Publish Mailgun's SPF, DKIM, tracking, and receiving DNS records as required.
3. Set `MAILGUN_REGION` to the region where the domain was created.
4. Use a sender address on that verified domain in `MAILGUN_FROM`.
5. Confirm that paid-order and ready-for-collection messages arrive successfully.

Sandbox Mailgun domains can only send to authorised recipients and are not suitable
for customer-facing production use.

## Release checklist

- Production PostgreSQL database created and backed up
- All environment variables pass `npm run deploy:check`
- Live Stripe key and live webhook signing secret configured
- Mailgun domain verified and out of sandbox restrictions
- Custom HTTPS domain active
- `/api/health` returns HTTP 200
- `/admin` challenges for credentials and is not cached
- Test order appears in the admin dashboard
- Paid-order email reaches the administrator
- Fulfilment email reaches the customer
- Order can be marked collected

Do not commit `.env` or production credentials. Database migrations in
`prisma/migrations` should be committed with every future schema change.
