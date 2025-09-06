-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_resets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."magic_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "public"."refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "public"."refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "public"."password_resets"("user_id");

-- CreateIndex
CREATE INDEX "password_resets_token_hash_idx" ON "public"."password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "password_resets_expires_at_idx" ON "public"."password_resets"("expires_at");

-- CreateIndex
CREATE INDEX "magic_links_user_id_idx" ON "public"."magic_links"("user_id");

-- CreateIndex
CREATE INDEX "magic_links_token_hash_idx" ON "public"."magic_links"("token_hash");

-- CreateIndex
CREATE INDEX "magic_links_purpose_idx" ON "public"."magic_links"("purpose");

-- CreateIndex
CREATE INDEX "magic_links_expires_at_idx" ON "public"."magic_links"("expires_at");

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."magic_links" ADD CONSTRAINT "magic_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
