-- CreateEnum
CREATE TYPE "public"."Fruit" AS ENUM ('LOVE', 'JOY', 'PEACE', 'PATIENCE', 'KINDNESS', 'GOODNESS', 'FAITHFULNESS', 'GENTLENESS', 'SELF_CONTROL');

-- CreateEnum
CREATE TYPE "public"."StreakKind" AS ENUM ('PRAYER', 'SCRIPTURE', 'WELLNESS');

-- CreateTable
CREATE TABLE "public"."xp_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fruit" "public"."Fruit" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."xp_totals" (
    "user_id" UUID NOT NULL,
    "love" INTEGER NOT NULL DEFAULT 0,
    "joy" INTEGER NOT NULL DEFAULT 0,
    "peace" INTEGER NOT NULL DEFAULT 0,
    "patience" INTEGER NOT NULL DEFAULT 0,
    "kindness" INTEGER NOT NULL DEFAULT 0,
    "goodness" INTEGER NOT NULL DEFAULT 0,
    "faithfulness" INTEGER NOT NULL DEFAULT 0,
    "gentleness" INTEGER NOT NULL DEFAULT 0,
    "self_control" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xp_totals_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."streaks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "public"."StreakKind" NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "last_at" TIMESTAMP(3),

    CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "xp_events_user_id_idx" ON "public"."xp_events"("user_id");

-- CreateIndex
CREATE INDEX "xp_events_fruit_idx" ON "public"."xp_events"("fruit");

-- CreateIndex
CREATE INDEX "xp_events_created_at_idx" ON "public"."xp_events"("created_at");

-- CreateIndex
CREATE INDEX "streaks_user_id_idx" ON "public"."streaks"("user_id");

-- CreateIndex
CREATE INDEX "streaks_kind_idx" ON "public"."streaks"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "streaks_user_id_kind_key" ON "public"."streaks"("user_id", "kind");

-- AddForeignKey
ALTER TABLE "public"."xp_events" ADD CONSTRAINT "xp_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."xp_totals" ADD CONSTRAINT "xp_totals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."streaks" ADD CONSTRAINT "streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
