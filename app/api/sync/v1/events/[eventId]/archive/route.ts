import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { readAuthenticatedJson, syncError } from "@/lib/sync-auth";

type ArchiveBody = { operationId: string; albumId?: string | null; removeImageData: boolean; retainReportingData: boolean; unavailableMessage?: string };

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  try {
    const body = await readAuthenticatedJson<ArchiveBody>(request); const { eventId } = await context.params;
    if (!body.operationId || !body.removeImageData || !body.retainReportingData) return Response.json({ error: "invalid_archive_request" }, { status: 400 });
    const event = await prisma.galleryEvent.findUnique({ where: { id: eventId } });
    if (!event) return Response.json({ archived: true, deletedObjects: 0 });
    let albumIds: string[] | undefined;
    if (body.albumId) {
      const album = await prisma.galleryAlbum.findFirst({ where: { id: body.albumId, eventId }, include: { children: { select: { id: true } } } });
      if (!album) return Response.json({ archived: true, deletedObjects: 0 });
      albumIds = [album.id, ...album.children.map((child) => child.id)];
    }
    const images = await prisma.galleryImage.findMany({ where: { eventId, ...(albumIds ? { albumId: { in: albumIds } } : {}) }, select: { thumbnailPath: true, previewPath: true } });
    const now = new Date();
    await prisma.$transaction([
      prisma.galleryImage.updateMany({ where: { eventId, ...(albumIds ? { albumId: { in: albumIds } } : {}) }, data: { active: false, archivedAt: now } }),
      prisma.galleryAlbum.updateMany({ where: { eventId, ...(albumIds ? { id: { in: albumIds } } : {}) }, data: { active: false, archivedAt: now } }),
      prisma.galleryEvent.update({ where: { id: eventId }, data: albumIds ? { unavailableMessage: body.unavailableMessage } : { status: "archived", ordersEnabled: false, archivedAt: now, unavailableMessage: body.unavailableMessage } })
    ]);
    const paths = images.flatMap((image) => [image.thumbnailPath, image.previewPath]).filter((path): path is string => Boolean(path));
    if (paths.length) await del(paths);
    await prisma.galleryImage.updateMany({ where: { eventId, active: false, ...(albumIds ? { albumId: { in: albumIds } } : {}) }, data: { thumbnailPath: null, previewPath: null } });
    return Response.json({ archived: true, deletedObjects: paths.length });
  } catch (error) { return syncError(error); }
}
