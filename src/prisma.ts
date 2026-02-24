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
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "nationalId" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "kycStatus" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "kycStatus" = 'Pending'
    WHERE "kycStatus" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "kycStatus" SET DEFAULT 'Pending'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "kycStatus" SET NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "addressLine1" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "addressLine2" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "city" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "country" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "postalCode" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "preferredCurrency" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "preferredCurrency" = 'MNT'
    WHERE "preferredCurrency" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "preferredCurrency" SET DEFAULT 'MNT'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "preferredCurrency" SET NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "marketingOptIn" = FALSE
    WHERE "marketingOptIn" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "marketingOptIn" SET DEFAULT FALSE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "marketingOptIn" SET NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "twoFactorEnabled" = TRUE
    WHERE "twoFactorEnabled" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "twoFactorEnabled" SET DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "twoFactorEnabled" SET NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "language" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "language" = 'MN'
    WHERE "language" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "language" SET DEFAULT 'MN'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "language" SET NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "loginAlerts" BOOLEAN
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "loginAlerts" = TRUE
    WHERE "loginAlerts" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "loginAlerts" SET DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "loginAlerts" SET NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "emailNotifications" = TRUE
    WHERE "emailNotifications" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "emailNotifications" SET DEFAULT TRUE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "emailNotifications" SET NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "smsNotifications" BOOLEAN
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "smsNotifications" = FALSE
    WHERE "smsNotifications" IS NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "smsNotifications" SET DEFAULT FALSE
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "smsNotifications" SET NOT NULL
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
