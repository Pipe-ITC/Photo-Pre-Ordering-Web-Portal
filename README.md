# Photeam Festival Order Portal

A responsive order and collection portal for weekend football festivals. Customers
select from five fixed products, enter the required photo image IDs, and pay through
Stripe Checkout. Staff receive a paid-order email and manage fulfilment and collection
from a protected admin board.

## Features

- Five fixed products with product-specific image ID validation
- Server-configurable prices in pence
- Stripe-hosted card checkout and signed webhook handling
- Order persistence in SQLite through Prisma
- Admin email after successful payment, including every image ID
- Password-protected `/admin` order board
- Fulfilled and collected status controls
- Automatic ready-for-collection customer email
- Responsive visual design based on the Photeam website

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the Stripe, admin, and email settings.

3. Create the local database:

   ```bash
   npm run db:push
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Forward Stripe test webhooks:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   Put the resulting `whsec_...` value in `STRIPE_WEBHOOK_SECRET`.

## Configuration

Product prices are set in `.env` and use pence, so `PRICE_MEDIUM_PRINT="1200"`
means £12.00. The fallback demo prices are:

| Product | Environment variable | Default |
| --- | --- | ---: |
| Medium Print | `PRICE_MEDIUM_PRINT` | £12.00 |
| Large Print | `PRICE_LARGE_PRINT` | £18.00 |
| Medium/Large Bundle | `PRICE_MEDIUM_LARGE_BUNDLE` | £26.00 |
| Filled Frame | `PRICE_FILLED_FRAME` | £45.00 |
| Medal Frame | `PRICE_MEDAL_FRAME` | £38.00 |

`RESEND_API_KEY` and `EMAIL_FROM` use the Resend email API. If they are omitted in
development, email events are logged instead of sent. The admin board uses HTTP Basic
Authentication configured by `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

## Production notes

SQLite is ideal for a single persistent server. For serverless or multi-instance
hosting, switch the Prisma datasource to PostgreSQL before launch. The Stripe webhook
is the authoritative payment update and ignores duplicate successful events.
