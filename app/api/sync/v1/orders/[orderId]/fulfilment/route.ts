import { prisma } from "@/lib/prisma";
import { readAuthenticatedJson, syncError } from "@/lib/sync-auth";

type Body = { localOrderId: string; localOrderNumber: number; status: string; version: number; fulfilledAt?: string | null };

export async function PUT(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const body = await readAuthenticatedJson<Body>(request); const { orderId } = await context.params;
    if (!body.localOrderId || !Number.isInteger(body.localOrderNumber) || body.version < 1 || !["Submitted", "Cancelled"].includes(body.status)) return Response.json({ error: "invalid_order_state" }, { status: 400 });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentStatus !== "paid") return Response.json({ error: "paid_order_not_found" }, { status: 404 });
    await prisma.order.update({ where: { id: orderId }, data: { sourceOrderId: body.localOrderId, sourceOrderNumber: String(body.localOrderNumber), sourceStatus: body.status, sourceOrderVersion: body.version, syncAcknowledgedAt: new Date(), sourceFulfilledAt: body.fulfilledAt ? new Date(body.fulfilledAt) : null, fulfilledAt: body.fulfilledAt ? new Date(body.fulfilledAt) : order.fulfilledAt } });
    return Response.json({ acknowledged: true });
  } catch (error) { return syncError(error); }
}
