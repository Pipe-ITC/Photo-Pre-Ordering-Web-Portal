import { prisma } from "@/lib/prisma";
import { readAuthenticatedJson, syncError } from "@/lib/sync-auth";

type Body = { serverId: string; mappings: Array<{ portalProductId: string; productId: string; code: string; name: string; imageCount: number }> };

export async function PUT(request: Request) {
  try {
    const body = await readAuthenticatedJson<Body>(request);
    await prisma.gallerySource.upsert({ where: { id: body.serverId }, create: { id: body.serverId, lastSeenAt: new Date() }, update: { lastSeenAt: new Date() } });
    await prisma.$transaction(body.mappings.map((mapping) => prisma.productMapping.upsert({ where: { sourceId_portalProductId: { sourceId: body.serverId, portalProductId: mapping.portalProductId } }, create: { sourceId: body.serverId, portalProductId: mapping.portalProductId, sourceProductId: mapping.productId, code: mapping.code, name: mapping.name, imageCount: mapping.imageCount }, update: { sourceProductId: mapping.productId, code: mapping.code, name: mapping.name, imageCount: mapping.imageCount } })));
    return Response.json({ saved: body.mappings.length });
  } catch (error) { return syncError(error); }
}
