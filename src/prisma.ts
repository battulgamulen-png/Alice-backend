import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
})

export const prisma = new PrismaClient({ adapter })

export async function ensureDatabaseSchema() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "balanceUsdCents" INTEGER
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "balanceUsdCents" = 100000
    WHERE "balanceUsdCents" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "balanceUsdCents" SET DEFAULT 100000
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "balanceUsdCents" SET NOT NULL
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Card" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "holderName" TEXT NOT NULL,
      "number" TEXT NOT NULL,
      "balanceUsdCents" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "holderName" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "number" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "balanceUsdCents" INTEGER DEFAULT 0
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "Card"
    SET "balanceUsdCents" = 0
    WHERE "balanceUsdCents" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Card_number_key" ON "Card"("number")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Card_userId_idx" ON "Card"("userId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardTransfer" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "fromCardId" TEXT NOT NULL,
      "toCardId" TEXT NOT NULL,
      "amountUsdCents" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTransfer_userId_createdAt_idx"
    ON "CardTransfer"("userId", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTransfer_fromCardId_createdAt_idx"
    ON "CardTransfer"("fromCardId", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTransfer_toCardId_createdAt_idx"
    ON "CardTransfer"("toCardId", "createdAt")
  `);
}
