/*
  Warnings:

  - You are about to drop the `static_deltas` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "static_deltas" DROP CONSTRAINT "static_deltas_team_id_fkey";

-- DropForeignKey
ALTER TABLE "static_deltas" DROP CONSTRAINT "static_deltas_team_id_from_fkey";

-- DropForeignKey
ALTER TABLE "static_deltas" DROP CONSTRAINT "static_deltas_team_id_to_fkey";

-- DropTable
DROP TABLE "static_deltas";

-- DropEnum
DROP TYPE "StaticDeltaStatus";
