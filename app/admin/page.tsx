import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/products";
import type { OrderedItem } from "@/lib/email";
import { OrderActions } from "./order-actions";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  if (!date) return "Not yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default async function AdminPage() {
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });
  const paid = orders.filter((order) => order.paymentStatus === "paid");
  const awaiting = paid.filter((order) => !order.fulfilledAt).length;
  const ready = paid.filter((order) => order.fulfilledAt && !order.collectedAt).length;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <span className="kicker">Festival operations</span>
          <h1>Order board</h1>
        </div>
        <a href="/" target="_blank">Open customer shop ↗</a>
      </header>

      <section className="admin-stats">
        <div><span>Paid orders</span><strong>{paid.length}</strong></div>
        <div><span>To fulfil</span><strong>{awaiting}</strong></div>
        <div><span>Ready to collect</span><strong>{ready}</strong></div>
        <div><span>Revenue</span><strong>{formatPrice(paid.reduce((sum, order) => sum + order.totalPence, 0))}</strong></div>
      </section>

      <section className="order-list">
        {orders.length === 0 && <div className="admin-empty">No festival orders yet.</div>}
        {orders.map((order) => {
          const items = order.items as unknown as OrderedItem[];
          return (
            <article className="admin-order" key={order.id}>
              <div className="order-topline">
                <div>
                  <span className={`payment-pill ${order.paymentStatus}`}>{order.paymentStatus}</span>
                  <h2>{order.orderNumber}</h2>
                  <p>{formatDate(order.createdAt)} · {order.customerName} · {order.customerEmail}</p>
                  {(order.teamName || order.customerPhone) && <p>{[order.teamName, order.customerPhone].filter(Boolean).join(" · ")}</p>}
                </div>
                <strong>{formatPrice(order.totalPence)}</strong>
              </div>

              <div className="admin-items">
                {items.map((item, index) => (
                  <div className="admin-item" key={`${item.productId}-${index}`}>
                    <strong>{item.productName}</strong>
                    <div>
                      {Object.entries(item.imageIds).map(([label, imageId]) => (
                        <span key={label}><b>{label}</b>{imageId}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-status">
                <span>Fulfilled: <b>{formatDate(order.fulfilledAt)}</b></span>
                <span>Collected: <b>{formatDate(order.collectedAt)}</b></span>
                <OrderActions
                  orderId={order.id}
                  fulfilled={Boolean(order.fulfilledAt)}
                  collected={Boolean(order.collectedAt)}
                  paymentStatus={order.paymentStatus}
                />
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
