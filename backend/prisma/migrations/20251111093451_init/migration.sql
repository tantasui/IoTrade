-- CreateEnum
CREATE TYPE "ApiKeyType" AS ENUM ('PROVIDER', 'SUBSCRIBER');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR', 'PAUSED');

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "type" "ApiKeyType" NOT NULL,
    "feed_id" TEXT,
    "subscription_id" TEXT,
    "provider_address" TEXT,
    "consumer_address" TEXT,
    "name" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "rate_limit" INTEGER,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "feed_id" TEXT,
    "subscription_id" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_time" INTEGER NOT NULL,
    "queries_used" INTEGER DEFAULT 0,
    "data_size" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "feed_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "name" TEXT,
    "device_type" TEXT,
    "location" TEXT,
    "description" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ONLINE',
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_data_at" TIMESTAMP(3),
    "consecutive_errors" INTEGER NOT NULL DEFAULT 0,
    "total_uploads" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_history" (
    "id" TEXT NOT NULL,
    "feed_id" TEXT NOT NULL,
    "blob_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_summary" JSONB,
    "data_size" INTEGER NOT NULL,
    "uploaded_by" TEXT,
    "device_id" TEXT,
    "api_key_id" TEXT,

    CONSTRAINT "data_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_feed_id_idx" ON "api_keys"("feed_id");

-- CreateIndex
CREATE INDEX "api_keys_subscription_id_idx" ON "api_keys"("subscription_id");

-- CreateIndex
CREATE INDEX "api_keys_provider_address_idx" ON "api_keys"("provider_address");

-- CreateIndex
CREATE INDEX "api_keys_consumer_address_idx" ON "api_keys"("consumer_address");

-- CreateIndex
CREATE INDEX "api_keys_type_revoked_at_idx" ON "api_keys"("type", "revoked_at");

-- CreateIndex
CREATE INDEX "usage_logs_api_key_id_idx" ON "usage_logs"("api_key_id");

-- CreateIndex
CREATE INDEX "usage_logs_feed_id_idx" ON "usage_logs"("feed_id");

-- CreateIndex
CREATE INDEX "usage_logs_subscription_id_idx" ON "usage_logs"("subscription_id");

-- CreateIndex
CREATE INDEX "usage_logs_timestamp_idx" ON "usage_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "devices_api_key_id_key" ON "devices"("api_key_id");

-- CreateIndex
CREATE INDEX "devices_feed_id_idx" ON "devices"("feed_id");

-- CreateIndex
CREATE INDEX "devices_status_last_seen_at_idx" ON "devices"("status", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "devices_feed_id_device_id_key" ON "devices"("feed_id", "device_id");

-- CreateIndex
CREATE INDEX "data_history_feed_id_timestamp_idx" ON "data_history"("feed_id", "timestamp");

-- CreateIndex
CREATE INDEX "data_history_blob_id_idx" ON "data_history"("blob_id");

-- CreateIndex
CREATE INDEX "data_history_uploaded_at_idx" ON "data_history"("uploaded_at");

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
