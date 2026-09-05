import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProduct, getProductPrice } from "@/lib/products";
import { getStripe } from "@/lib/stripe";
import type { OrderedItem } from "@/lib/email";
import { isOrderingOpen } from "@/lib/gallery";

type CheckoutBody = {
  eventToken?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    teamName?: string;
  };
  items?: Array<{
    productId?: string;
    imageIds?: string[];
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
    const galleryEvent = await prisma.galleryEvent.findUnique({ where: { publicToken: clean(body.eventToken, 80) } });
    if (!galleryEvent || !isOrderingOpen(galleryEvent)) return NextResponse.json({ error: "Orders are no longer being accepted for this event." }, { status: 409 });
    const submittedImageIds = body.items.flatMap((item) => item.imageIds || []);
    const galleryImages = await prisma.galleryImage.findMany({ where: { id: { in: submittedImageIds }, eventId: galleryEvent.id, active: true, archivedAt: null, album: { active: true, archivedAt: null } }, include: { album: true } });
    const imageById = new Map(galleryImages.map((image) => [image.id, image]));
    if (imageById.size !== new Set(submittedImageIds).size) return NextResponse.json({ error: "One or more selected photographs are no longer available." }, { status: 409 });
    const mappings = await prisma.productMapping.findMany({ where: { sourceId: galleryEvent.sourceId, portalProductId: { in: body.items.map((item) => clean(item.productId, 80)) } } });
    const mappingByProduct = new Map(mappings.map((mapping) => [mapping.portalProductId, mapping]));

    const items: OrderedItem[] = body.items.map((submittedItem) => {
      const product = getProduct(clean(submittedItem.productId, 80));
      if (!product) throw new Error("Your basket contains an unknown product.");
      const submittedIds = submittedItem.imageIds || []; const mapping = mappingByProduct.get(product.id);
      if (!mapping || mapping.imageCount !== product.imageFields.length || submittedIds.length !== product.imageFields.length || new Set(submittedIds).size !== submittedIds.length) throw new Error(`Choose ${product.imageFields.length} distinct photograph${product.imageFields.length === 1 ? "" : "s"} for ${product.name}.`);
      const imageIds = Object.fromEntries(
        product.imageFields.map((field, index) => {
          const label = field.label.replace(" image ID", "");
          const image = imageById.get(submittedIds[index]);
          if (!image) throw new Error(`A selected photograph for ${product.name} is no longer available.`);
          return [label, image.filename];
        })
      );

      return {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPricePence: getProductPrice(product),
        imageIds,
        galleryImageIds: submittedIds
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
        totalPence,
        eventId: galleryEvent.id,
        normalizedItems: { create: items.map((item, position) => ({ position: position + 1, portalProductId: item.productId, productName: item.productName, quantity: item.quantity, unitPricePence: item.unitPricePence, images: { create: item.galleryImageIds.map((imageId, imagePosition) => { const image = imageById.get(imageId)!; return { position: imagePosition + 1, imageId, filename: image.filename, albumName: image.album.name }; }) } })) }
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
