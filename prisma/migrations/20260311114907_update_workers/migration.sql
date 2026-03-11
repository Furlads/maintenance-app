/*
  Warnings:

  - You are about to drop the column `name` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Worker` table. All the data in the column will be lost.
  - Added the required column `accessLevel` to the `Worker` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Worker` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jobTitle` to the `Worker` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Worker` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Worker" DROP COLUMN "name",
DROP COLUMN "role",
ADD COLUMN     "accessLevel" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "jobTitle" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL;
