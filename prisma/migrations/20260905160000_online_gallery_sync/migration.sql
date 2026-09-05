CREATE TABLE "GallerySource" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    CONSTRAINT "GallerySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryEvent" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "publicToken" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'staging',
    "ordersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ordersCloseAt" TIMESTAMP(3),
    "unavailableMessage" TEXT NOT NULL DEFAULT 'Orders are no longer being accepted for this event.',
    "archivedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GalleryEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryAlbum" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "GalleryAlbum_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sourceHash" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "previewPath" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GallerySyncBatch" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'staging',
    "manifest" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "GallerySyncBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GallerySyncAsset" (
    "syncId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "previewPath" TEXT,
    CONSTRAINT "GallerySyncAsset_pkey" PRIMARY KEY ("syncId", "imageId")
);

CREATE TABLE "SyncNonce" (
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncNonce_pkey" PRIMARY KEY ("nonce")
);

CREATE TABLE "ProductMapping" (
    "portalProductId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageCount" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductMapping_pkey" PRIMARY KEY ("sourceId", "portalProductId")
);

CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "portalProductId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePence" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItemImage" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "imageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "albumName" TEXT NOT NULL,
    CONSTRAINT "OrderItemImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
    ADD COLUMN "eventId" TEXT,
    ADD COLUMN "paidAt" TIMESTAMP(3),
    ADD COLUMN "sourceOrderId" TEXT,
    ADD COLUMN "sourceOrderNumber" TEXT,
    ADD COLUMN "sourceStatus" TEXT,
    ADD COLUMN "sourceOrderVersion" INTEGER,
    ADD COLUMN "syncAcknowledgedAt" TIMESTAMP(3),
    ADD COLUMN "sourceFulfilledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "GalleryEvent_publicToken_key" ON "GalleryEvent"("publicToken");
CREATE INDEX "GalleryEvent_sourceId_status_idx" ON "GalleryEvent"("sourceId", "status");
CREATE INDEX "GalleryAlbum_eventId_parentId_name_idx" ON "GalleryAlbum"("eventId", "parentId", "name");
CREATE INDEX "GalleryImage_eventId_albumId_active_idx" ON "GalleryImage"("eventId", "albumId", "active");
CREATE INDEX "GalleryImage_eventId_filename_idx" ON "GalleryImage"("eventId", "filename");
CREATE UNIQUE INDEX "GallerySyncBatch_operationId_key" ON "GallerySyncBatch"("operationId");
CREATE INDEX "GallerySyncAsset_imageId_idx" ON "GallerySyncAsset"("imageId");
CREATE INDEX "SyncNonce_expiresAt_idx" ON "SyncNonce"("expiresAt");
CREATE UNIQUE INDEX "Order_sourceOrderId_key" ON "Order"("sourceOrderId");
CREATE INDEX "Order_paymentStatus_syncAcknowledgedAt_createdAt_idx" ON "Order"("paymentStatus", "syncAcknowledgedAt", "createdAt");
CREATE UNIQUE INDEX "OrderItem_orderId_position_key" ON "OrderItem"("orderId", "position");
CREATE UNIQUE INDEX "OrderItemImage_orderItemId_position_key" ON "OrderItemImage"("orderItemId", "position");
CREATE UNIQUE INDEX "OrderItemImage_orderItemId_imageId_key" ON "OrderItemImage"("orderItemId", "imageId");

ALTER TABLE "GalleryEvent" ADD CONSTRAINT "GalleryEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GallerySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GalleryAlbum" ADD CONSTRAINT "GalleryAlbum_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GalleryEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GalleryAlbum" ADD CONSTRAINT "GalleryAlbum_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GalleryAlbum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GalleryEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "GalleryAlbum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GallerySyncBatch" ADD CONSTRAINT "GallerySyncBatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GalleryEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GallerySyncAsset" ADD CONSTRAINT "GallerySyncAsset_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "GallerySyncBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GallerySyncAsset" ADD CONSTRAINT "GallerySyncAsset_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GalleryImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductMapping" ADD CONSTRAINT "ProductMapping_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GallerySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GalleryEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemImage" ADD CONSTRAINT "OrderItemImage_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemImage" ADD CONSTRAINT "OrderItemImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GalleryImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
