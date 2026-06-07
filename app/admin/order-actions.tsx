"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderActions({
  orderId,
  fulfilled,
  collected,
  paymentStatus
}: {
  orderId: string;
  fulfilled: boolean;
  collected: boolean;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function update(field: "fulfilled" | "collected", value: boolean) {
    setBusy(field);
    setError("");
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value })
    });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Update failed.");
    setBusy("");
    router.refresh();
  }

  const disabled = paymentStatus !== "paid";
  return (
    <div className="admin-actions">
      <button disabled={disabled || Boolean(busy)} onClick={() => update("fulfilled", !fulfilled)}>
        {busy === "fulfilled" ? "Updating…" : fulfilled ? "Undo fulfilled" : "Mark fulfilled"}
      </button>
      <button
        className="secondary"
        disabled={disabled || !fulfilled || Boolean(busy)}
        onClick={() => update("collected", !collected)}
      >
        {busy === "collected" ? "Updating…" : collected ? "Undo collected" : "Mark collected"}
      </button>
      {error && <small>{error}</small>}
    </div>
  );
}
