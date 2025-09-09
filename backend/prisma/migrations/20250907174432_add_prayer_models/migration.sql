-- CreateEnum
CREATE TYPE "public"."PrayerStatus" AS ENUM ('OPEN', 'ANSWERED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "public"."prayers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "group_id" UUID,
    "linked_post_id" UUID,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public"."PrayerStatus" NOT NULL DEFAULT 'OPEN',
    "commit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "prayers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."prayer_commits" (
    "id" UUID NOT NULL,
    "prayer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prayer_commits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prayers_user_id_idx" ON "public"."prayers"("user_id");

-- CreateIndex
CREATE INDEX "prayers_group_id_idx" ON "public"."prayers"("group_id");

-- CreateIndex
CREATE INDEX "prayers_linked_post_id_idx" ON "public"."prayers"("linked_post_id");

-- CreateIndex
CREATE INDEX "prayers_status_idx" ON "public"."prayers"("status");

-- CreateIndex
CREATE INDEX "prayers_created_at_idx" ON "public"."prayers"("created_at");

-- CreateIndex
CREATE INDEX "prayer_commits_prayer_id_idx" ON "public"."prayer_commits"("prayer_id");

-- CreateIndex
CREATE INDEX "prayer_commits_user_id_idx" ON "public"."prayer_commits"("user_id");

-- CreateIndex
CREATE INDEX "prayer_commits_created_at_idx" ON "public"."prayer_commits"("created_at");

-- AddForeignKey
ALTER TABLE "public"."prayers" ADD CONSTRAINT "prayers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prayers" ADD CONSTRAINT "prayers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prayers" ADD CONSTRAINT "prayers_linked_post_id_fkey" FOREIGN KEY ("linked_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prayer_commits" ADD CONSTRAINT "prayer_commits_prayer_id_fkey" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."prayer_commits" ADD CONSTRAINT "prayer_commits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
