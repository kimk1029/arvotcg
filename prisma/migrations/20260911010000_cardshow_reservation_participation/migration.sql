-- cardshow_reservations: 입장 완료 후 이벤트 참여 / 리뷰 이벤트 참여 확정 시각
ALTER TABLE "cardshow_reservations" ADD COLUMN IF NOT EXISTS "eventJoinedAt" TIMESTAMP(3);
ALTER TABLE "cardshow_reservations" ADD COLUMN IF NOT EXISTS "reviewJoinedAt" TIMESTAMP(3);
