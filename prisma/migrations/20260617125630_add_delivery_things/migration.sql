-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DELIVERY';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "delivererId" TEXT;

-- AlterTable
ALTER TABLE "TempUser" ADD COLUMN     "cnibRecto" TEXT,
ADD COLUMN     "cnibVerso" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cnibRecto" TEXT,
ADD COLUMN     "cnibVerso" TEXT,
ADD COLUMN     "isValidated" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
