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

  if (body.collected === true && !existing.fulfilledAt && body.fulfilled !== true) {
    return NextResponse.json(
      { error: "An order must be fulfilled before it can be collected." },
      { status: 400 }
    );
  }

  if (body.fulfilled === true && !existing.readyEmailSentAt) {
    try {
      await sendReadyForCollectionEmail(existing);
    } catch (error) {
      console.error("Ready email failed", error);
      return NextResponse.json(
        { error: "The customer email could not be sent, so the order was not marked fulfilled." },
        { status: 502 }
      );
    }
  }

  await prisma.order.update({
    where: { id },
    data: {
      ...(typeof body.fulfilled === "boolean"
        ? {
            fulfilledAt: body.fulfilled ? existing.fulfilledAt || new Date() : null,
            ...(body.fulfilled && !existing.readyEmailSentAt
              ? { readyEmailSentAt: new Date() }
              : {}),
            ...(!body.fulfilled ? { collectedAt: null } : {})
          }
        : {}),
      ...(typeof body.collected === "boolean"
        ? { collectedAt: body.collected ? existing.collectedAt || new Date() : null }
        : {})
    }
  });

  return NextResponse.json({ ok: true });
}
