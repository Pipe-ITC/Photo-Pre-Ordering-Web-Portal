import Link from "next/link";

export default async function CancelledPage({
  searchParams
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  return (
    <main className="status-page">
      <div className="status-card">
        <img src="https://www.photeam.co.uk/wp-content/uploads/2023/08/Photeam-Logo.png" alt="Photeam" />
        <span className="kicker dark">Payment not completed</span>
        <h1>Your order is still waiting.</h1>
        <p>
          No payment was taken{order ? ` for ${order}` : ""}. Return to the shop when
          you’re ready to try again.
        </p>
        <Link className="primary-button" href="/#basket">Return to the shop</Link>
      </div>
    </main>
  );
}
