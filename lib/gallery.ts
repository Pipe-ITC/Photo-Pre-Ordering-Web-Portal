import { prisma } from "@/lib/prisma";

export const ARCHIVED_EVENT_MESSAGE = "Orders are no longer being accepted for this event.";

export function isOrderingOpen(event: { status: string; ordersEnabled: boolean; ordersCloseAt: Date | null }) {
  return event.status === "published" && event.ordersEnabled && (!event.ordersCloseAt || event.ordersCloseAt.getTime() > Date.now());
}

export async function getPublicEvent(publicToken: string, requestedAlbumId?: string) {
  const event = await prisma.galleryEvent.findUnique({ where: { publicToken }, include: {
    source: { select: { mappings: { select: { portalProductId: true } } } },
    albums: { orderBy: [{ parentId: "asc" }, { name: "asc" }] },
    images: { where: { active: true, archivedAt: null }, orderBy: [{ filename: "asc" }, { id: "asc" }] }
  } });
  if (!event) return { event: null, unavailable: ARCHIVED_EVENT_MESSAGE, availableProductIds: [] as string[] };
  if (event.status !== "published" || event.archivedAt) return { event, unavailable: event.unavailableMessage || ARCHIVED_EVENT_MESSAGE, availableProductIds: [] as string[] };
  if (requestedAlbumId) {
    const requested = event.albums.find((album) => album.id === requestedAlbumId);
    if (!requested || requested.archivedAt || !requested.active) return { event, unavailable: event.unavailableMessage || ARCHIVED_EVENT_MESSAGE, availableProductIds: [] as string[] };
  }
  return { event, unavailable: null, availableProductIds: event.source.mappings.map((mapping) => mapping.portalProductId) };
}
