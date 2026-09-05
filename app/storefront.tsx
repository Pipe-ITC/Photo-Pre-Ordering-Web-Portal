"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { trackInteraction } from "@/lib/analytics";
import { formatPrice, Product } from "@/lib/products";

type PublicProduct = Product & { pricePence: number };
export type PublicAlbum = { id: string; parentId: string | null; name: string };
export type PublicImage = { id: string; albumId: string; filename: string; width: number | null; height: number | null };
type Selection = { label: string; imageId: string; filename: string; albumName: string };
type CartItem = { lineId: string; productId: string; productName: string; pricePence: number; selections: Selection[] };

export function Storefront({ event, products, albums, images, orderingOpen, initialAlbumId }: { event: { name: string; publicToken: string; ordersCloseAt: string | null }; products: PublicProduct[]; albums: PublicAlbum[]; images: PublicImage[]; orderingOpen: boolean; initialAlbumId?: string }) {
  const leafAlbums = albums.filter((album) => album.parentId); const firstAlbumId = leafAlbums.find((album) => album.id === initialAlbumId)?.id || leafAlbums[0]?.id || ""; const [albumId, setAlbumId] = useState(firstAlbumId);
  const [selected, setSelected] = useState<PublicProduct | null>(null); const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", teamName: "" }); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.pricePence, 0), [cart]);
  const currentImages = images.filter((image) => image.albumId === albumId); const currentAlbum = albums.find((album) => album.id === albumId); const parentName = albums.find((album) => album.id === currentAlbum?.parentId)?.name;

  function addItem(product: PublicProduct, selections: Selection[]) {
    setCart((items) => [...items, { lineId: crypto.randomUUID(), productId: product.id, productName: product.name, pricePence: product.pricePence, selections }]);
    trackInteraction("cart_item_added", { product_id: product.id, item_count: cart.length + 1, cart_value_pence: total + product.pricePence }); setSelected(null);
  }
  async function checkout(eventForm: FormEvent) {
    eventForm.preventDefault(); setError(""); setSubmitting(true);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventToken: event.publicToken, customer, items: cart.map((item) => ({ productId: item.productId, imageIds: item.selections.map((selection) => selection.imageId) })) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not start checkout."); window.location.href = result.url;
    } catch (checkoutError) { setError(checkoutError instanceof Error ? checkoutError.message : "Something went wrong."); setSubmitting(false); }
  }

  return <main>
    {!orderingOpen && <div className="ordering-closed-banner" role="status">Online orders are no longer being accepted for this event, please visit the photo tent to place your order</div>}
    <header className="site-header"><a className="brand" href="#top"><strong>PHOTEAM</strong><small>{event.name}</small></a>{orderingOpen && <a className="basket-link" href="#basket">Basket <span>{cart.length}</span></a>}</header>
    <section className="hero gallery-hero" id="top"><div className="hero-copy"><span className="kicker">Festival photo collection</span><h1>{event.name}</h1><p>Browse the event albums, choose your photographs and order prints for collection.</p></div></section>
    <section className="gallery-section"><div className="section-heading"><div><span className="kicker dark">Event gallery</span><h2>Choose your photographs</h2></div></div>
      <div className="gallery-layout"><nav className="gallery-albums" aria-label="Albums">{albums.filter((album) => !album.parentId).map((group) => <section key={group.id}><strong>{group.name}</strong>{leafAlbums.filter((album) => album.parentId === group.id).map((album) => <a key={album.id} className={album.id === albumId ? "active" : ""} href={`?album=${album.id}`} onClick={(click) => { click.preventDefault(); history.replaceState(null, "", `?album=${album.id}`); setAlbumId(album.id); }}>{album.name}</a>)}</section>)}</nav>
      <div className="gallery-content"><p className="gallery-breadcrumb">{currentAlbum ? `${parentName} / ${currentAlbum.name}` : "Choose an album"}</p><div className="gallery-grid">{currentImages.map((photo) => <article key={photo.id}><div className="gallery-image"><Image unoptimized src={`/e/${event.publicToken}/images/${photo.id}/thumbnail`} alt={photo.filename} fill sizes="(max-width: 700px) 45vw, 220px" /></div><strong title={photo.filename}>{photo.filename}</strong></article>)}</div>{albumId && currentImages.length === 0 && <p>No photographs are currently available in this album.</p>}</div></div>
    </section>
    {orderingOpen && <section className="products-section" id="products"><div className="section-heading"><div><span className="kicker dark">Festival collection</span><h2>Choose your finish</h2></div></div><div className="product-grid">{products.map((product) => <article className={`product-card ${product.accent}`} key={product.id}><span className="product-eyebrow">{product.eyebrow}</span><h3>{product.name}</h3><p>{product.description}</p><div className="product-footer"><strong>{formatPrice(product.pricePence)}</strong><button onClick={() => setSelected(product)}>Choose photos</button></div></article>)}</div></section>}
    {orderingOpen && <section className="basket-section" id="basket"><div className="basket-panel"><div className="section-heading compact"><div><span className="kicker dark">Your order</span><h2>Festival basket</h2></div><strong className="basket-total">{formatPrice(total)}</strong></div>
      {!cart.length ? <div className="empty-basket"><span>0</span><p>Your basket is waiting for its first photo.</p></div> : <div className="cart-lines">{cart.map((item) => <div className="cart-line" key={item.lineId}><div><strong>{item.productName}</strong>{item.selections.map((selection) => <span key={selection.label}>{selection.label}: <b>{selection.filename}</b></span>)}</div><div><strong>{formatPrice(item.pricePence)}</strong><button onClick={() => setCart((items) => items.filter((line) => line.lineId !== item.lineId))}>Remove</button></div></div>)}</div>}
      <form className="customer-form" onSubmit={checkout}><h3>Collection details</h3><div className="form-grid"><label>Your name<input required value={customer.name} onChange={(change) => setCustomer({ ...customer, name: change.target.value })} /></label><label>Email address<input required type="email" value={customer.email} onChange={(change) => setCustomer({ ...customer, email: change.target.value })} /></label><label>Mobile number<input value={customer.phone} onChange={(change) => setCustomer({ ...customer, phone: change.target.value })} /></label><label>Team name<input value={customer.teamName} onChange={(change) => setCustomer({ ...customer, teamName: change.target.value })} /></label></div>{error && <p className="form-error">{error}</p>}<button className="checkout-button" disabled={!orderingOpen || !cart.length || submitting}>{submitting ? "Taking you to Stripe…" : orderingOpen ? `Pay ${formatPrice(total)} securely` : "Online ordering closed"}</button></form>
    </div></section>}
    {orderingOpen && selected && <GalleryPicker product={selected} albums={albums} images={images} token={event.publicToken} onClose={() => setSelected(null)} onAdd={(selections) => addItem(selected, selections)} />}
  </main>;
}

function GalleryPicker({ product, albums, images, token, onClose, onAdd }: { product: PublicProduct; albums: PublicAlbum[]; images: PublicImage[]; token: string; onClose: () => void; onAdd: (values: Selection[]) => void }) {
  const leaves = albums.filter((album) => album.parentId); const [albumId, setAlbumId] = useState(leaves[0]?.id || ""); const [values, setValues] = useState<Selection[]>([]); const required = product.imageFields.length;
  function choose(photo: PublicImage) { if (values.some((value) => value.imageId === photo.id) || values.length >= required) return; const field = product.imageFields[values.length]; const album = albums.find((candidate) => candidate.id === photo.albumId)!; setValues((current) => [...current, { label: field.label.replace(" image ID", ""), imageId: photo.id, filename: photo.filename, albumName: album.name }]); }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal gallery-picker" role="dialog" aria-modal="true" aria-labelledby="gallery-picker-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close photograph picker" onClick={onClose}>×</button><h2 id="gallery-picker-title">{product.name}</h2><p>Select {required} distinct photograph{required === 1 ? "" : "s"}. Next: <strong>{product.imageFields[values.length]?.label || "Complete"}</strong></p><div className="picker-selections">{values.map((value) => <button key={value.label} onClick={() => setValues((current) => current.filter((entry) => entry.label !== value.label))}>{value.label}: {value.filename} ×</button>)}</div><label className="sr-only" htmlFor="picker-album">Album</label><select id="picker-album" value={albumId} onChange={(change) => setAlbumId(change.target.value)}>{leaves.map((album) => <option key={album.id} value={album.id}>{albums.find((parent) => parent.id === album.parentId)?.name} / {album.name}</option>)}</select><div className="gallery-grid picker-grid">{images.filter((image) => image.albumId === albumId).map((photo) => <button type="button" key={photo.id} disabled={values.some((value) => value.imageId === photo.id)} onClick={() => choose(photo)}><div className="gallery-image"><Image unoptimized src={`/e/${token}/images/${photo.id}/thumbnail`} alt={photo.filename} fill sizes="160px" /></div><span>{photo.filename}</span></button>)}</div><button className="checkout-button" disabled={values.length !== required} onClick={() => onAdd(values)}>Add to basket · {formatPrice(product.pricePence)}</button></div></div>;
}
