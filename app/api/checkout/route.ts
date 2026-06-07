import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProduct, getProductPrice } from "@/lib/products";
import { getStripe } from "@/lib/stripe";
import type { OrderedItem } from "@/lib/email";

type CheckoutBody = {
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    teamName?: string;
  };
  items?: Array<{
    productId?: string;
    imageIds?: Record<string, string>;
  }>;
};

function clean(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function makeOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `PF-${date}-${suffix}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const customerName = clean(body.customer?.name);
    const customerEmail = clean(body.customer?.email).toLowerCase();

    if (!customerName || !customerEmail || !customerEmail.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid name and email address." }, { status: 400 });
    }

    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
      return NextResponse.json({ error: "Your basket must contain between 1 and 30 items." }, { status: 400 });
    }

    const items: OrderedItem[] = body.items.map((submittedItem) => {
      const product = getProduct(clean(submittedItem.productId, 80));
      if (!product) throw new Error("Your basket contains an unknown product.");

      const submittedIds = submittedItem.imageIds || {};
      const imageIds = Object.fromEntries(
        product.imageFields.map((field) => {
          const label = field.label.replace(" image ID", "");
          const value = clean(submittedIds[label], 80).toUpperCase();
          if (!value) throw new Error(`Please provide every image ID for ${product.name}.`);
          return [label, value];
        })
      );

      return {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPricePence: getProductPrice(product),
        imageIds
      };
    });

    const totalPence = items.reduce((total, item) => total + item.unitPricePence, 0);
    const order = await prisma.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        customerName,
        customerEmail,
        customerPhone: clean(body.customer?.phone, 40) || null,
        teamName: clean(body.customer?.teamName, 100) || null,
        items,
        totalPence
      }
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber
      },
      line_items: items.map((item) => ({
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: item.unitPricePence,
          product_data: {
            name: item.productName,
            description: Object.entries(item.imageIds)
              .map(([label, value]) => `${label}: ${value}`)
              .join(" · ")
          }
        }
      })),
      success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/order/cancelled?order=${order.orderNumber}`,
      payment_intent_data: {
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber
        }
      }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: session.id }
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start checkout." },
      { status: 500 }
    );
  }
}
