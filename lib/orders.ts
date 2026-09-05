import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  sendAdminOrderEmail,
  sendOrderConfirmationEmail,
  type OrderedItem
} from "@/lib/email";

type ReconcileOptions = {
  throwOnNotificationFailure?: boolean;
};

export async function reconcilePaidCheckoutSession(
  session: Stripe.Checkout.Session,
  options: ReconcileOptions = {}
) {
  if (session.payment_status !== "paid") {
    return { status: "not-paid" as const, order: null };
  }

  const candidateOrderIds = [
    session.metadata?.orderId,
    session.client_reference_id
  ].filter((value): value is string => Boolean(value));

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        ...(candidateOrderIds.length ? [{ id: { in: candidateOrderIds } }] : []),
        { stripeCheckoutSessionId: session.id }
      ]
    }
  });

  if (!order) {
    throw new Error(
      `No order found for Stripe Checkout Session ${session.id}.`
    );
  }

  const paidOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "paid",
      paidAt: order.paidAt || new Date(),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : order.stripePaymentIntentId
    }
  });

  const confirmationClaim = await prisma.order.updateMany({
    where: {
      id: paidOrder.id,
      orderConfirmationSentAt: null
    },
    data: { orderConfirmationSentAt: new Date() }
  });

  if (confirmationClaim.count === 1) {
    try {
      await sendOrderConfirmationEmail({
        orderNumber: paidOrder.orderNumber,
        customerName: paidOrder.customerName,
        customerEmail: paidOrder.customerEmail,
        totalPence: paidOrder.totalPence,
        items: paidOrder.items as unknown as OrderedItem[]
      });
    } catch (error) {
      await prisma.order.update({
        where: { id: paidOrder.id },
        data: { orderConfirmationSentAt: null }
      });
      console.error(
        `Order confirmation failed for order ${paidOrder.orderNumber}`,
        error
      );
      if (options.throwOnNotificationFailure) throw error;
    }
  }

  if (!paidOrder.adminNotifiedAt) {
    try {
      await sendAdminOrderEmail({
        orderNumber: paidOrder.orderNumber,
        customerName: paidOrder.customerName,
        customerEmail: paidOrder.customerEmail,
        paymentStatus: "Paid successfully",
        items: paidOrder.items as unknown as OrderedItem[]
      });

      await prisma.order.update({
        where: { id: paidOrder.id },
        data: { adminNotifiedAt: new Date() }
      });
    } catch (error) {
      console.error(
        `Admin notification failed for order ${paidOrder.orderNumber}`,
        error
      );
      if (options.throwOnNotificationFailure) throw error;
    }
  }

  return { status: "paid" as const, order: paidOrder };
}
