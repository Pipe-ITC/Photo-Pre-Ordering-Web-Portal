import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendAdminOrderEmail, type OrderedItem } from "@/lib/email";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId && session.payment_status === "paid") {
      const existing = await prisma.order.findUnique({ where: { id: orderId } });
      if (existing && existing.paymentStatus !== "paid") {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "paid",
            stripePaymentIntentId:
              typeof session.payment_intent === "string" ? session.payment_intent : null
          }
        });

        await sendAdminOrderEmail({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          paymentStatus: "Paid successfully",
          items: order.items as unknown as OrderedItem[]
        });
      }
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.orderId) {
      await prisma.order.update({
        where: { id: session.metadata.orderId },
        data: { paymentStatus: "failed" }
      });
    }
  }

  return NextResponse.json({ received: true });
}
