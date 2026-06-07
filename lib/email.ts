type EmailOptions = {
  to: string;
  subject: string;
  html: string;
};

async function sendEmail({ to, subject, html }: EmailOptions) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.info(`[email skipped] ${subject} -> ${to}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}: ${await response.text()}`);
  }
}

export type OrderedItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPricePence: number;
  imageIds: Record<string, string>;
};

function itemRows(items: OrderedItem[]) {
  return items
    .map((item) => {
      const ids = Object.entries(item.imageIds)
        .map(([label, value]) => `<li><strong>${label}:</strong> ${value}</li>`)
        .join("");
      return `<div style="padding:16px 0;border-bottom:1px solid #d9e2ea">
        <strong>${item.quantity} × ${item.productName}</strong>
        <ul>${ids}</ul>
      </div>`;
    })
    .join("");
}

export async function sendAdminOrderEmail(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  paymentStatus: string;
  items: OrderedItem[];
}) {
  if (!process.env.ADMIN_EMAIL) return;
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `New paid festival order ${order.orderNumber}`,
    html: `<h1>New festival order</h1>
      <p><strong>Order:</strong> ${order.orderNumber}</p>
      <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
      <p><strong>Payment:</strong> ${order.paymentStatus}</p>
      ${itemRows(order.items)}`
  });
}

export async function sendReadyForCollectionEmail(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
}) {
  const collectionPoint =
    process.env.NEXT_PUBLIC_COLLECTION_POINT || "the Photeam collection desk";
  await sendEmail({
    to: order.customerEmail,
    subject: `Your Photeam order ${order.orderNumber} is ready`,
    html: `<h1>Your photos are ready!</h1>
      <p>Hi ${order.customerName},</p>
      <p>Your order <strong>${order.orderNumber}</strong> has been prepared and is ready to collect from ${collectionPoint}.</p>
      <p>Thank you,<br>Photeam</p>`
  });
}
