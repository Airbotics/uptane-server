-- CreateEnum
CREATE TYPE "KeyType" AS ENUM ('rsa');

-- CreateTable
CREATE TABLE "tuf_keys" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "role" "TUFRole" NOT NULL,
    "repo" "TUFRepo" NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "key_type" "KeyType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tuf_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tuf_keys_id_key" ON "tuf_keys"("id");

-- CreateIndex
CREATE UNIQUE INDEX "tuf_keys_team_id_id_key" ON "tuf_keys"("team_id", "id");

-- AddForeignKey
ALTER TABLE "tuf_keys" ADD CONSTRAINT "tuf_keys_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
