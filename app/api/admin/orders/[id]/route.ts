import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReadyForCollectionEmail } from "@/lib/email";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    fulfilled?: boolean;
    collected?: boolean;
  };

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const shouldSendReadyEmail = body.fulfilled === true && !existing.fulfilledAt;
  const order = await prisma.order.update({
    where: { id },
    data: {
      ...(typeof body.fulfilled === "boolean"
        ? { fulfilledAt: body.fulfilled ? new Date() : null }
        : {}),
      ...(typeof body.collected === "boolean"
        ? { collectedAt: body.collected ? new Date() : null }
        : {})
    }
  });

  if (shouldSendReadyEmail) {
    try {
      await sendReadyForCollectionEmail(order);
    } catch (error) {
      console.error("Ready email failed", error);
      return NextResponse.json(
        { error: "Order was marked fulfilled, but the customer email could not be sent." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
