import { getPublicProducts } from "@/lib/products";
import { getPublicEvent, isOrderingOpen } from "@/lib/gallery";
import { Storefront } from "@/app/storefront";

export const dynamic = "force-dynamic";

export default async function EventPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ album?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]); const result = await getPublicEvent(token, query.album);
  if (!result.event || result.unavailable) return <main className="unavailable-page"><section><span className="kicker dark">Festival photographs</span><h1>Gallery unavailable</h1><p>{result.unavailable}</p><p className="muted">If you have already ordered, your order and collection details are still safely recorded.</p></section></main>;
  const availableProducts = new Set(result.availableProductIds);
  return <Storefront event={{ name: result.event.name, publicToken: result.event.publicToken, ordersCloseAt: result.event.ordersCloseAt?.toISOString() || null }} products={getPublicProducts().filter((product) => availableProducts.has(product.id))} albums={result.event.albums.filter((album) => album.active && !album.archivedAt).map((album) => ({ id: album.id, parentId: album.parentId, name: album.name }))} images={result.event.images.map((image) => ({ id: image.id, albumId: image.albumId, filename: image.filename, width: image.width, height: image.height }))} orderingOpen={isOrderingOpen(result.event)} initialAlbumId={query.album} />;
}
