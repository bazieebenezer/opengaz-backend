/*
  Warnings:

  - You are about to drop the column `description` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "description",
DROP COLUMN "imageUrl",
DROP COLUMN "name",
DROP COLUMN "price",
ADD COLUMN     "categoryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TempUser" ADD COLUMN     "closingTime" TEXT,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "openingTime" TEXT,
ADD COLUMN     "selectedGases" TEXT[],
ADD COLUMN     "shopImage" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "closingTime" TEXT,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "openingTime" TEXT,
ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordOtp" TEXT,
ADD COLUMN     "selectedGases" TEXT[],
ADD COLUMN     "shopImage" TEXT;

-- CreateTable
CREATE TABLE "GasCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT NOT NULL,

    CONSTRAINT "GasCategory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GasCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
