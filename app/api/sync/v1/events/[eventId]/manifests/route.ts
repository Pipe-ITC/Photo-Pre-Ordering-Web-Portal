import { prisma } from "@/lib/prisma";
import { readAuthenticatedJson, syncError } from "@/lib/sync-auth";

type Manifest = {
  operationId: string; serverId: string; eventId: string; name: string; date: string; publicToken: string; revision: number;
  ordersEnabled: boolean; ordersCloseAt?: string | null;
  albums: Array<{ id: string; parentId?: string | null; name: string; version: number }>;
  images: Array<{ id: string; albumId: string; filename: string; width?: number | null; height?: number | null; sourceHash: string }>;
};
type ManifestUpload = { photoId: string; kind: "web-thumbnail" | "web-preview"; path: string };
type StoredBatchManifest = Manifest & { uploads?: ManifestUpload[] };

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  try {
    const manifest = await readAuthenticatedJson<Manifest>(request); const { eventId } = await context.params;
    if (manifest.eventId !== eventId || !manifest.operationId || !manifest.serverId || !manifest.publicToken || manifest.revision < 1) return Response.json({ error: "invalid_manifest" }, { status: 400 });
    const replay = await prisma.gallerySyncBatch.findUnique({ where: { operationId: manifest.operationId } });
    if (replay) {
      const stored = replay.manifest as unknown as StoredBatchManifest;
      return Response.json({ syncId: replay.id, uploads: replay.status === "completed" ? [] : stored.uploads || [] });
    }
    const existingEvent = await prisma.galleryEvent.findUnique({ where: { id: eventId }, select: { revision: true, status: true } });
    if (existingEvent && manifest.revision < existingEvent.revision) return Response.json({ error: "stale_manifest" }, { status: 409 });
    const existingImages = await prisma.galleryImage.findMany({ where: { eventId }, select: { id: true, sourceHash: true, thumbnailPath: true, previewPath: true } });
    const existing = new Map(existingImages.map((image) => [image.id, image]));
    const uploads = requiredUploads(crypto.randomUUID(), manifest, existing);
    const replacedPaths = manifest.images.flatMap((image) => {
      const prior = existing.get(image.id);
      return prior && prior.sourceHash !== image.sourceHash ? [prior.thumbnailPath, prior.previewPath].filter((path): path is string => Boolean(path)) : [];
    });
    const manifestImageIds = new Set(manifest.images.map((image) => image.id));
    const removedPaths = existingImages.filter((image) => !manifestImageIds.has(image.id)).flatMap((image) => [image.thumbnailPath, image.previewPath]).filter((path): path is string => Boolean(path));
    const syncId = uploads.syncId;
    await prisma.$transaction(async (tx) => {
      await tx.gallerySource.upsert({ where: { id: manifest.serverId }, create: { id: manifest.serverId, lastSeenAt: new Date() }, update: { lastSeenAt: new Date() } });
      await tx.galleryEvent.upsert({ where: { id: eventId }, create: { id: eventId, sourceId: manifest.serverId, name: manifest.name, eventDate: new Date(`${manifest.date}T12:00:00Z`), publicToken: manifest.publicToken, revision: manifest.revision, status: "staging", ordersEnabled: false, ordersCloseAt: manifest.ordersCloseAt ? new Date(manifest.ordersCloseAt) : null }, update: { name: manifest.name, eventDate: new Date(`${manifest.date}T12:00:00Z`), publicToken: manifest.publicToken, revision: manifest.revision, status: existingEvent?.status === "published" ? "published" : "staging", ordersCloseAt: manifest.ordersCloseAt ? new Date(manifest.ordersCloseAt) : null, archivedAt: null } });
      for (const album of manifest.albums.filter((value) => !value.parentId)) await tx.galleryAlbum.upsert({ where: { id: album.id }, create: { id: album.id, eventId, name: album.name, version: album.version }, update: { eventId, name: album.name, version: album.version, archivedAt: null } });
      for (const album of manifest.albums.filter((value) => value.parentId)) await tx.galleryAlbum.upsert({ where: { id: album.id }, create: { id: album.id, eventId, parentId: album.parentId, name: album.name, version: album.version }, update: { eventId, parentId: album.parentId, name: album.name, version: album.version, archivedAt: null } });
      for (const image of manifest.images) await tx.galleryImage.upsert({ where: { id: image.id }, create: { id: image.id, eventId, albumId: image.albumId, filename: image.filename, width: image.width, height: image.height, sourceHash: image.sourceHash }, update: { eventId, albumId: image.albumId, filename: image.filename, width: image.width, height: image.height } });
      await tx.gallerySyncBatch.create({ data: { id: syncId, operationId: manifest.operationId, eventId, revision: manifest.revision, manifest: { ...manifest, replacedPaths, removedPaths, uploads: uploads.items } as never } });
    });
    return Response.json({ syncId, uploads: uploads.items });
  } catch (error) { return syncError(error); }
}

function requiredUploads(syncId: string, manifest: Manifest, existing: Map<string, { sourceHash: string; thumbnailPath: string | null; previewPath: string | null }>) {
  const items = manifest.images.flatMap((image): ManifestUpload[] => {
    const prior = existing.get(image.id); const changed = !prior || prior.sourceHash !== image.sourceHash;
    return [
      ...(!prior?.thumbnailPath || changed ? [{ photoId: image.id, kind: "web-thumbnail" as const, path: `/api/sync/v1/uploads/${syncId}/${image.id}/web-thumbnail` }] : []),
      ...(!prior?.previewPath || changed ? [{ photoId: image.id, kind: "web-preview" as const, path: `/api/sync/v1/uploads/${syncId}/${image.id}/web-preview` }] : [])
    ];
  });
  return { syncId, items };
}
