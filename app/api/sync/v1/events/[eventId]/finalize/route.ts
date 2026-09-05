import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { readAuthenticatedJson, syncError } from "@/lib/sync-auth";

type FinalizeBody = { operationId: string; syncId: string };
type StoredManifest = { images: Array<{ id: string; sourceHash: string }>; albums: Array<{ id: string }>; uploads?: Array<{ photoId: string; kind: string }>; ordersEnabled: boolean; ordersCloseAt?: string | null; replacedPaths?: string[]; removedPaths?: string[] };

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  try {
    const body = await readAuthenticatedJson<FinalizeBody>(request); const { eventId } = await context.params;
    const batch = await prisma.gallerySyncBatch.findUnique({ where: { id: body.syncId } });
    if (!batch || batch.eventId !== eventId || batch.operationId !== body.operationId) return Response.json({ error: "invalid_sync_batch" }, { status: 409 });
    if (batch.status === "completed") return Response.json({ published: true });
    const currentEvent = await prisma.galleryEvent.findUnique({ where: { id: eventId }, select: { revision: true } });
    if (!currentEvent || currentEvent.revision !== batch.revision) return Response.json({ error: "stale_sync_batch" }, { status: 409 });
    const manifest = batch.manifest as unknown as StoredManifest; const imageIds = manifest.images.map((image) => image.id); const albumIds = manifest.albums.map((album) => album.id);
    const assets = await prisma.gallerySyncAsset.findMany({ where: { syncId: batch.id } });
    const assetByImage = new Map(assets.map((asset) => [asset.imageId, asset]));
    const incomplete = (manifest.uploads || []).filter((upload) => upload.kind === "web-thumbnail" ? !assetByImage.get(upload.photoId)?.thumbnailPath : !assetByImage.get(upload.photoId)?.previewPath);
    if (incomplete.length) return Response.json({ error: "incomplete_assets", count: incomplete.length }, { status: 409 });
    const obsolete = await prisma.galleryImage.findMany({ where: { eventId, id: { notIn: imageIds }, active: true }, select: { thumbnailPath: true, previewPath: true } });
    await prisma.$transaction(async (tx) => {
      await tx.galleryAlbum.updateMany({ where: { eventId, id: { in: albumIds } }, data: { active: true, archivedAt: null } });
      await tx.galleryAlbum.updateMany({ where: { eventId, id: { notIn: albumIds } }, data: { active: false, archivedAt: new Date() } });
      for (const image of manifest.images) {
        const asset = assetByImage.get(image.id);
        await tx.galleryImage.update({ where: { id: image.id }, data: { active: true, archivedAt: null, sourceHash: image.sourceHash, ...(asset?.thumbnailPath ? { thumbnailPath: asset.thumbnailPath } : {}), ...(asset?.previewPath ? { previewPath: asset.previewPath } : {}) } });
      }
      await tx.galleryImage.updateMany({ where: { eventId, id: { notIn: imageIds } }, data: { active: false, archivedAt: new Date() } });
      await tx.galleryEvent.update({ where: { id: eventId }, data: { status: "published", ordersEnabled: manifest.ordersEnabled, ordersCloseAt: manifest.ordersCloseAt ? new Date(manifest.ordersCloseAt) : null, archivedAt: null } });
    });
    const paths = [...new Set([...obsolete.flatMap((image) => [image.thumbnailPath, image.previewPath]).filter((path): path is string => Boolean(path)), ...(manifest.replacedPaths || []), ...(manifest.removedPaths || [])])];
    if (paths.length) await del(paths);
    await prisma.$transaction([
      prisma.galleryImage.updateMany({ where: { eventId, id: { notIn: imageIds }, active: false }, data: { thumbnailPath: null, previewPath: null } }),
      prisma.gallerySyncBatch.update({ where: { id: batch.id }, data: { status: "completed", completedAt: new Date() } })
    ]);
    return Response.json({ published: true });
  } catch (error) { return syncError(error); }
}
