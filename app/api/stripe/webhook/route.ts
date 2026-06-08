import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { reconcilePaidCheckoutSession } from "@/lib/orders";

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

  console.info(`Stripe webhook received: ${event.type} (${event.id})`);

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const result = await reconcilePaidCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
        { throwOnNotificationFailure: true }
      );
      console.info(`Stripe reconciliation result: ${result.status}`);
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const candidateOrderIds = [
        session.metadata?.orderId,
        session.client_reference_id
      ].filter((value): value is string => Boolean(value));

      await prisma.order.updateMany({
        where: {
          paymentStatus: { not: "paid" },
          OR: [
            ...(candidateOrderIds.length
              ? [{ id: { in: candidateOrderIds } }]
              : []),
            { stripeCheckoutSessionId: session.id }
          ]
        },
        data: { paymentStatus: "failed" }
      });
    }
  } catch (error) {
    console.error(`Stripe webhook processing failed for ${event.id}`, error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
