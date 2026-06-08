const required = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "PRICE_MEDIUM_PRINT",
  "PRICE_LARGE_PRINT",
  "PRICE_MEDIUM_LARGE_BUNDLE",
  "PRICE_FILLED_FRAME",
  "PRICE_MEDAL_FRAME",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_EMAIL",
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
  "MAILGUN_FROM",
  "MAILGUN_REGION",
  "NEXT_PUBLIC_FESTIVAL_NAME",
  "NEXT_PUBLIC_COLLECTION_POINT"
];

const priceVariables = required.filter((name) => name.startsWith("PRICE_"));
const missing = required.filter((name) => !process.env[name]?.trim());
const errors = [];
const warnings = [];

if (missing.length) {
  errors.push(`Missing variables: ${missing.join(", ")}`);
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (siteUrl) {
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== "https:") {
      errors.push("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
    }
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
      errors.push("NEXT_PUBLIC_SITE_URL must be an origin without a path, query, or hash.");
    }
  } catch {
    errors.push("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.");
  }
}

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("postgresql://")) {
  errors.push("DATABASE_URL must be a PostgreSQL connection string.");
}

for (const name of priceVariables) {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${name} must be a positive integer in pence.`);
  }
}

if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 16) {
  errors.push("ADMIN_PASSWORD must contain at least 16 characters.");
}

if (process.env.MAILGUN_REGION && !["EU", "US"].includes(process.env.MAILGUN_REGION.toUpperCase())) {
  errors.push('MAILGUN_REGION must be either "EU" or "US".');
}

if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  warnings.push("STRIPE_SECRET_KEY is a test key, so real payments will not be taken.");
}

if (errors.length) {
  console.error("Production configuration is not ready:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Production configuration is valid.");
for (const warning of warnings) console.warn(`Warning: ${warning}`);
