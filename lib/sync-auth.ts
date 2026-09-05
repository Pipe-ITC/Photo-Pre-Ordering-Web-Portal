import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const MAX_CLOCK_SKEW_SECONDS = 300;

class SyncAuthenticationError extends Error {}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authenticateSyncRequest(request: Request, body: Uint8Array) {
  const timestamp = request.headers.get("x-eventphoto-timestamp") || "";
  const nonce = request.headers.get("x-eventphoto-nonce") || "";
  const suppliedHash = request.headers.get("x-eventphoto-content-sha256") || "";
  const suppliedSignature = request.headers.get("x-eventphoto-signature") || "";
  const parsedTimestamp = Number(timestamp);
  if (!nonce || nonce.length > 80 || !Number.isInteger(parsedTimestamp) || Math.abs(Date.now() / 1000 - parsedTimestamp) > MAX_CLOCK_SKEW_SECONDS) throw new SyncAuthenticationError("invalid_sync_timestamp");
  const contentHash = createHash("sha256").update(body).digest("hex");
  if (!safeEqual(contentHash, suppliedHash)) throw new SyncAuthenticationError("invalid_sync_content_hash");
  const url = new URL(request.url);
  const canonical = `${request.method}\n${url.pathname}${url.search}\n${timestamp}\n${nonce}\n${contentHash}`;
  const credentials = [process.env.SYNC_CREDENTIAL, process.env.SYNC_CREDENTIAL_NEXT].filter((value): value is string => Boolean(value));
  if (!credentials.length || !credentials.some((credential) => safeEqual(createHmac("sha256", credential).update(canonical).digest("hex"), suppliedSignature))) throw new SyncAuthenticationError("invalid_sync_signature");
  await prisma.syncNonce.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  try { await prisma.syncNonce.create({ data: { nonce, expiresAt: new Date(Date.now() + MAX_CLOCK_SKEW_SECONDS * 1000) } }); }
  catch { throw new SyncAuthenticationError("replayed_sync_request"); }
}

export async function readAuthenticatedJson<T>(request: Request): Promise<T> {
  const body = new Uint8Array(await request.arrayBuffer());
  await authenticateSyncRequest(request, body);
  return JSON.parse(new TextDecoder().decode(body)) as T;
}

export function syncError(error: unknown) {
  if (error instanceof SyncAuthenticationError) {
    console.warn("Portal sync request rejected", error.message);
    return Response.json({ error: error.message }, { status: 401 });
  }
  console.error("Portal sync request failed", error);
  return Response.json({ error: "sync_request_failed" }, { status: 500 });
}
