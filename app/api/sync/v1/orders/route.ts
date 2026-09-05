import { prisma } from "@/lib/prisma";
import { authenticateSyncRequest, syncError } from "@/lib/sync-auth";

export async function GET(request: Request) {
  try {
    await authenticateSyncRequest(request, new Uint8Array());
    const orders = await prisma.order.findMany({ where: { paymentStatus: "paid", eventId: { not: null }, syncAcknowledgedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 50, include: { normalizedItems: { orderBy: { position: "asc" }, include: { images: { orderBy: { position: "asc" } } } } } });
    return Response.json({ nextCursor: orders.at(-1)?.id || new URL(request.url).searchParams.get("after") || "", items: orders.map((order) => ({
      id: order.id, orderNumber: order.orderNumber, eventId: order.eventId, paymentReference: order.stripePaymentIntentId || order.stripeCheckoutSessionId || "", paidAt: order.paidAt || order.updatedAt,
      customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone, teamName: order.teamName,
      items: order.normalizedItems.map((item) => ({ portalProductId: item.portalProductId, quantity: item.quantity, photoIds: item.images.map((image) => image.imageId) }))
    })) });
  } catch (error) { return syncError(error); }
}
