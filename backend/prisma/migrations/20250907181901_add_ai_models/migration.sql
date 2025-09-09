-- CreateEnum
CREATE TYPE "public"."AIResponseKind" AS ENUM ('DEVOTIONAL', 'PRAYER');

-- CreateTable
CREATE TABLE "public"."ai_responses" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "kind" "public"."AIResponseKind" NOT NULL,
    "prompt" JSONB NOT NULL,
    "output" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "flags" JSONB,
    "template_version" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scripture_refs" (
    "id" UUID NOT NULL,
    "ai_response_id" UUID NOT NULL,
    "book" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verse_start" INTEGER NOT NULL,
    "verse_end" INTEGER NOT NULL,

    CONSTRAINT "scripture_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokens_in" INTEGER NOT NULL,
    "tokens_out" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,4) NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_responses_user_id_idx" ON "public"."ai_responses"("user_id");

-- CreateIndex
CREATE INDEX "ai_responses_kind_idx" ON "public"."ai_responses"("kind");

-- CreateIndex
CREATE INDEX "ai_responses_allowed_idx" ON "public"."ai_responses"("allowed");

-- CreateIndex
CREATE INDEX "ai_responses_created_at_idx" ON "public"."ai_responses"("created_at");

-- CreateIndex
CREATE INDEX "scripture_refs_ai_response_id_idx" ON "public"."scripture_refs"("ai_response_id");

-- CreateIndex
CREATE INDEX "scripture_refs_book_idx" ON "public"."scripture_refs"("book");

-- CreateIndex
CREATE INDEX "scripture_refs_chapter_idx" ON "public"."scripture_refs"("chapter");

-- CreateIndex
CREATE INDEX "ai_usage_user_id_idx" ON "public"."ai_usage"("user_id");

-- CreateIndex
CREATE INDEX "ai_usage_provider_idx" ON "public"."ai_usage"("provider");

-- CreateIndex
CREATE INDEX "ai_usage_model_idx" ON "public"."ai_usage"("model");

-- CreateIndex
CREATE INDEX "ai_usage_created_at_idx" ON "public"."ai_usage"("created_at");

-- AddForeignKey
ALTER TABLE "public"."ai_responses" ADD CONSTRAINT "ai_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scripture_refs" ADD CONSTRAINT "scripture_refs_ai_response_id_fkey" FOREIGN KEY ("ai_response_id") REFERENCES "public"."ai_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
