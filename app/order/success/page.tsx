import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  let orderNumber = "";
  let paid = false;

  if (sessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      paid = session.payment_status === "paid";
      const order = await prisma.order.findUnique({
        where: { stripeCheckoutSessionId: sessionId }
      });
      orderNumber = order?.orderNumber || session.metadata?.orderNumber || "";
    } catch {
      // The webhook remains the authoritative payment record.
    }
  }

  return (
    <main className="status-page">
      <div className="status-card">
        <img src="https://www.photeam.co.uk/wp-content/uploads/2023/08/Photeam-Logo.png" alt="Photeam" />
        <span className="status-icon">✓</span>
        <span className="kicker dark">{paid ? "Payment successful" : "Order received"}</span>
        <h1>That’s in the net.</h1>
        <p>
          Your order {orderNumber && <strong>{orderNumber}</strong>} has been received.
          We’ll email you as soon as it is ready to collect.
        </p>
        <Link className="primary-button" href="/">Back to festival shop</Link>
      </div>
    </main>
  );
}
