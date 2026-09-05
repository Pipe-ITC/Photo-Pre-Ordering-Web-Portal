import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { authenticateSyncRequest, syncError } from "@/lib/sync-auth";

export async function PUT(request: Request, context: { params: Promise<{ syncId: string; photoId: string; kind: string }> }) {
  try {
    const body = new Uint8Array(await request.arrayBuffer()); await authenticateSyncRequest(request, body);
    const { syncId, photoId, kind } = await context.params;
    if (!body.length || !["web-thumbnail", "web-preview"].includes(kind)) return Response.json({ error: "invalid_upload" }, { status: 400 });
    const batch = await prisma.gallerySyncBatch.findUnique({ where: { id: syncId } });
    const image = await prisma.galleryImage.findUnique({ where: { id: photoId } });
    const manifest = batch?.manifest as { images?: Array<{ id: string }> } | undefined;
    if (!batch || batch.status !== "staging" || !image || image.eventId !== batch.eventId || !manifest?.images?.some((item) => item.id === photoId)) return Response.json({ error: "invalid_upload_target" }, { status: 409 });
    const pathname = `events/${batch.eventId}/images/${photoId}/${syncId}-${kind}.jpg`;
    const blob = await put(pathname, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "image/jpeg", cacheControlMaxAge: 3600 });
    await prisma.gallerySyncAsset.upsert({ where: { syncId_imageId: { syncId, imageId: photoId } }, create: { syncId, imageId: photoId, ...(kind === "web-thumbnail" ? { thumbnailPath: blob.pathname } : { previewPath: blob.pathname }) }, update: kind === "web-thumbnail" ? { thumbnailPath: blob.pathname } : { previewPath: blob.pathname } });
    return Response.json({ stored: true });
  } catch (error) { return syncError(error); }
}
