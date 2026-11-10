-- AlterTable
ALTER TABLE "conversation_messages" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'completed';
ALTER TABLE "conversation_messages" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';
