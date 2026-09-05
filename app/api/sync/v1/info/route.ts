import { authenticateSyncRequest, syncError } from "@/lib/sync-auth";

export async function GET(request: Request) {
  try {
    await authenticateSyncRequest(request, new Uint8Array());
    return Response.json({ contractVersion: "v1", storage: "vercel-blob-private", capabilities: ["event-manifests", "album-archive", "order-cutoff", "paid-order-export", "fulfilment-status"] });
  } catch (error) { return syncError(error); }
}
