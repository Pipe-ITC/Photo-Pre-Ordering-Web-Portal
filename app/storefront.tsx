"use client";

import { FormEvent, useMemo, useState } from "react";
import { trackInteraction } from "@/lib/analytics";
import { formatPrice, ImageField, Product } from "@/lib/products";

type PublicProduct = Product & { pricePence: number };
type CartItem = {
  lineId: string;
  productId: string;
  productName: string;
  pricePence: number;
  imageIds: Record<string, string>;
};

export function Storefront({ products }: { products: PublicProduct[] }) {
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    teamName: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.pricePence, 0),
    [cart]
  );

  function addItem(product: PublicProduct, imageIds: Record<string, string>) {
    trackInteraction("cart_item_added", {
      product_id: product.id,
      product_name: product.name,
      item_count: cart.length + 1,
      cart_value_pence: total + product.pricePence
    });
    setCart((items) => [
      ...items,
      {
        lineId: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        pricePence: product.pricePence,
        imageIds
      }
    ]);
    setSelected(null);
  }

  function removeItem(item: CartItem) {
    const nextCart = cart.filter((line) => line.lineId !== item.lineId);
    trackInteraction("cart_item_removed", {
      product_id: item.productId,
      product_name: item.productName,
      item_count: nextCart.length,
      cart_value_pence: nextCart.reduce((sum, line) => sum + line.pricePence, 0)
    });
    setCart(nextCart);
  }

  async function checkout(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    trackInteraction("checkout_started", {
      item_count: cart.length,
      cart_value_pence: total
    });
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, items: cart })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start checkout.");
      trackInteraction("checkout_redirected", {
        item_count: cart.length,
        cart_value_pence: total
      });
      window.location.href = result.url;
    } catch (checkoutError) {
      trackInteraction("checkout_failed", {
        item_count: cart.length,
        cart_value_pence: total
      });
      setError(checkoutError instanceof Error ? checkoutError.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const festivalName =
    process.env.NEXT_PUBLIC_FESTIVAL_NAME || "Weekend Football Festival";

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Photeam festival orders">
          <img
            src="https://www.photeam.co.uk/wp-content/uploads/2023/08/Photeam-Logo.png"
            alt="Photeam"
          />
          <span>
            <strong>PHOTEAM</strong>
            <small>Giving your team the superstar treatment</small>
          </span>
        </a>
        <a className="basket-link" href="#basket">
          Basket <span>{cart.length}</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="kicker">Festival photo collection</span>
          <h1>Your best moments. <em>Made to keep.</em></h1>
          <p>
            Choose your products, enter the image IDs displayed at the festival,
            and pay securely online. We’ll prepare everything for collection.
          </p>
          <a className="primary-button" href="#products">Build your order</a>
        </div>
        <div className="hero-photo" aria-label="Youth football action">
          <div className="festival-badge">
            <span>Now shooting</span>
            <strong>{festivalName}</strong>
          </div>
        </div>
      </section>

      <section className="steps">
        <div><b>01</b><span>Find your photo IDs</span></div>
        <div><b>02</b><span>Choose your products</span></div>
        <div><b>03</b><span>Pay securely with Stripe</span></div>
        <div><b>04</b><span>Collect when notified</span></div>
      </section>

      <section className="products-section" id="products">
        <div className="section-heading">
          <div>
            <span className="kicker dark">Festival collection</span>
            <h2>Choose your finish</h2>
          </div>
          <p>Every item is prepared by the Photeam crew during the festival weekend.</p>
        </div>
        <div className="product-grid">
          {products.map((product, index) => (
            <article className={`product-card ${product.accent}`} key={product.id}>
              <div className="product-number">0{index + 1}</div>
              <span className="product-eyebrow">{product.eyebrow}</span>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <ul>
                {product.imageFields.map((field) => <li key={field.key}>{field.label}</li>)}
              </ul>
              <div className="product-footer">
                <strong>{formatPrice(product.pricePence)}</strong>
                <button
                  onClick={() => {
                    trackInteraction("product_selected", {
                      product_id: product.id,
                      product_name: product.name,
                      price_pence: product.pricePence
                    });
                    setSelected(product);
                  }}
                >
                  Add to basket
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="basket-section" id="basket">
        <div className="basket-panel">
          <div className="section-heading compact">
            <div>
              <span className="kicker dark">Your order</span>
              <h2>Festival basket</h2>
            </div>
            <strong className="basket-total">{formatPrice(total)}</strong>
          </div>

          {cart.length === 0 ? (
            <div className="empty-basket">
              <span>0</span>
              <p>Your basket is waiting for its first photo.</p>
              <a href="#products">Browse products</a>
            </div>
          ) : (
            <div className="cart-lines">
              {cart.map((item) => (
                <div className="cart-line" key={item.lineId}>
                  <div>
                    <strong>{item.productName}</strong>
                    {Object.entries(item.imageIds).map(([label, id]) => (
                      <span key={label}>{label}: <b>{id}</b></span>
                    ))}
                  </div>
                  <div>
                    <strong>{formatPrice(item.pricePence)}</strong>
                    <button onClick={() => removeItem(item)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form className="customer-form" onSubmit={checkout}>
            <h3>Collection details</h3>
            <div className="form-grid">
              <label>
                Your name
                <input required value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              </label>
              <label>
                Email address
                <input required type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
              </label>
              <label>
                Mobile number
                <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
              </label>
              <label>
                Team name
                <input value={customer.teamName} onChange={(e) => setCustomer({ ...customer, teamName: e.target.value })} />
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="checkout-button" disabled={cart.length === 0 || submitting}>
              {submitting ? "Taking you to Stripe…" : `Pay ${formatPrice(total)} securely`}
            </button>
            <p className="secure-note">Secure payment powered by Stripe. Card details never touch this website.</p>
          </form>
        </div>
      </section>

      <footer>
        <strong>PHOTEAM</strong>
        <span>Sports, school & family photography</span>
        <a href="https://www.photeam.co.uk/privacy/">Privacy & data protection</a>
      </footer>

      {selected && (
        <ImageIdModal
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={(ids) => addItem(selected, ids)}
        />
      )}
    </main>
  );
}

function ImageIdModal({
  product,
  onClose,
  onAdd
}: {
  product: PublicProduct;
  onClose: () => void;
  onAdd: (ids: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const labelled = Object.fromEntries(
      product.imageFields.map((field) => [field.label.replace(" image ID", ""), values[field.key].trim().toUpperCase()])
    );
    onAdd(labelled);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <span className="kicker dark">{product.eyebrow}</span>
        <h2 id="modal-title">{product.name}</h2>
        <p>Enter the image IDs exactly as they appear on the photo viewing boards.</p>
        <form onSubmit={submit}>
          {product.imageFields.map((field: ImageField) => (
            <label key={field.key}>
              {field.label}
              <input
                required
                autoComplete="off"
                placeholder="e.g. DSC_4821"
                value={values[field.key] || ""}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
              />
              <small>{field.hint}</small>
            </label>
          ))}
          <button className="checkout-button">Add to basket · {formatPrice(product.pricePence)}</button>
        </form>
      </div>
    </div>
  );
}
