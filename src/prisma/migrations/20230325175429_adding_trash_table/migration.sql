/*
  Warnings:

  - You are about to drop the column `serial` on the `certificates` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TrashResource" AS ENUM ('blob_storage_directory', 'ostree_image', 'certificate');

-- DropIndex
DROP INDEX "certificates_serial_key";

-- AlterTable
ALTER TABLE "certificates" DROP COLUMN "serial";

-- CreateTable
CREATE TABLE "trash" (
    "id" TEXT NOT NULL,
    "resource_type" "TrashResource" NOT NULL,
    "resource_id" TEXT NOT NULL,

    CONSTRAINT "trash_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trash_id_key" ON "trash"("id");
