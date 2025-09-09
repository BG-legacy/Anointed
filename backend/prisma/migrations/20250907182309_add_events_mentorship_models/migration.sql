-- CreateEnum
CREATE TYPE "public"."EventVisibility" AS ENUM ('PUBLIC', 'GROUP', 'PRIVATE');

-- CreateEnum
CREATE TYPE "public"."RsvpStatus" AS ENUM ('GOING', 'INTERESTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "public"."MentorshipStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."events" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "visibility" "public"."EventVisibility" NOT NULL DEFAULT 'PUBLIC',
    "group_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."event_rsvps" (
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "public"."RsvpStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("event_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."mentorships" (
    "id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "mentee_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."MentorshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentorships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mentor_sessions" (
    "id" UUID NOT NULL,
    "mentorship_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_created_by_idx" ON "public"."events"("created_by");

-- CreateIndex
CREATE INDEX "events_group_id_idx" ON "public"."events"("group_id");

-- CreateIndex
CREATE INDEX "events_visibility_idx" ON "public"."events"("visibility");

-- CreateIndex
CREATE INDEX "events_starts_at_idx" ON "public"."events"("starts_at");

-- CreateIndex
CREATE INDEX "events_ends_at_idx" ON "public"."events"("ends_at");

-- CreateIndex
CREATE INDEX "event_rsvps_user_id_idx" ON "public"."event_rsvps"("user_id");

-- CreateIndex
CREATE INDEX "event_rsvps_status_idx" ON "public"."event_rsvps"("status");

-- CreateIndex
CREATE INDEX "mentorships_mentor_id_idx" ON "public"."mentorships"("mentor_id");

-- CreateIndex
CREATE INDEX "mentorships_mentee_id_idx" ON "public"."mentorships"("mentee_id");

-- CreateIndex
CREATE INDEX "mentorships_status_idx" ON "public"."mentorships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mentorships_mentor_id_mentee_id_key" ON "public"."mentorships"("mentor_id", "mentee_id");

-- CreateIndex
CREATE INDEX "mentor_sessions_mentorship_id_idx" ON "public"."mentor_sessions"("mentorship_id");

-- CreateIndex
CREATE INDEX "mentor_sessions_scheduled_at_idx" ON "public"."mentor_sessions"("scheduled_at");

-- CreateIndex
CREATE INDEX "mentor_sessions_completed_at_idx" ON "public"."mentor_sessions"("completed_at");

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."event_rsvps" ADD CONSTRAINT "event_rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mentorships" ADD CONSTRAINT "mentorships_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mentorships" ADD CONSTRAINT "mentorships_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mentor_sessions" ADD CONSTRAINT "mentor_sessions_mentorship_id_fkey" FOREIGN KEY ("mentorship_id") REFERENCES "public"."mentorships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
