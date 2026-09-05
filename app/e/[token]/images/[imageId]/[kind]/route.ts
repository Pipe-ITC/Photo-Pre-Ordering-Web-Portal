import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ token: string; imageId: string; kind: string }> }) {
  const { token, imageId, kind } = await context.params;
  if (!["thumbnail", "preview"].includes(kind)) return new Response("Not found", { status: 404 });
  const image = await prisma.galleryImage.findFirst({ where: { id: imageId, active: true, archivedAt: null, event: { publicToken: token, status: "published", archivedAt: null }, album: { active: true, archivedAt: null } } });
  if (!image) return Response.json({ message: "Orders are no longer being accepted for this event." }, { status: 410 });
  const pathname = kind === "thumbnail" ? image.thumbnailPath : image.previewPath;
  if (!pathname) return new Response("Image unavailable", { status: 404 });
  const conditional = request.headers.get("if-none-match");
  const blob = await get(pathname, { access: "private", ...(conditional ? { headers: { "If-None-Match": conditional } } : {}) });
  if (!blob) return new Response("Image unavailable", { status: 404 });
  if (blob.statusCode === 304) return new Response(null, { status: 304, headers: { ETag: blob.blob.etag } });
  return new Response(blob.stream, { headers: { "Content-Type": blob.blob.contentType, "Content-Disposition": `inline; filename="${image.filename.replaceAll('"', '')}"`, "Cache-Control": "private, no-store, max-age=0", ETag: blob.blob.etag, "X-Content-Type-Options": "nosniff" } });
}
