-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "specs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreListing" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "storeProductName" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "StoreListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "inStock" BOOLEAN NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "productsFound" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "errorSummary" TEXT,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Product_canonicalName_category_key" ON "Product"("canonicalName", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Store_name_key" ON "Store"("name");

-- CreateIndex
CREATE INDEX "StoreListing_productId_idx" ON "StoreListing"("productId");

-- CreateIndex
CREATE INDEX "StoreListing_storeId_idx" ON "StoreListing"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreListing_storeId_url_key" ON "StoreListing"("storeId", "url");

-- CreateIndex
CREATE INDEX "PriceHistory_listingId_idx" ON "PriceHistory"("listingId");

-- CreateIndex
CREATE INDEX "PriceHistory_scrapedAt_idx" ON "PriceHistory"("scrapedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ScrapeRun_storeId_idx" ON "ScrapeRun"("storeId");

-- CreateIndex
CREATE INDEX "ScrapeRun_startedAt_idx" ON "ScrapeRun"("startedAt");

-- AddForeignKey
ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreListing" ADD CONSTRAINT "StoreListing_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "StoreListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
