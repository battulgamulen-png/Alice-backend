"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.ensureDatabaseSchema = ensureDatabaseSchema;
require("dotenv/config");
const prisma_1 = require("./generated/prisma");
const adapter_neon_1 = require("@prisma/adapter-neon");
const adapter = new adapter_neon_1.PrismaNeon({
    connectionString: process.env.DATABASE_URL,
});
exports.prisma = new prisma_1.PrismaClient({ adapter });
async function ensureDatabaseSchema() {
    await exports.prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "balanceUsdCents" INTEGER
  `);
    await exports.prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "balanceUsdCents" = 100000
    WHERE "balanceUsdCents" IS NULL
  `);
    await exports.prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "balanceUsdCents" SET DEFAULT 100000
  `);
    await exports.prisma.$executeRawUnsafe(`
    ALTER TABLE "User"
    ALTER COLUMN "balanceUsdCents" SET NOT NULL
  `);
    await exports.prisma.$executeRawUnsafe(`
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
    await exports.prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "holderName" TEXT
  `);
    await exports.prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "number" TEXT
  `);
    await exports.prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "balanceUsdCents" INTEGER DEFAULT 0
  `);
    await exports.prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
  `);
    await exports.prisma.$executeRawUnsafe(`
    ALTER TABLE "Card"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
  `);
    await exports.prisma.$executeRawUnsafe(`
    UPDATE "Card"
    SET "balanceUsdCents" = 0
    WHERE "balanceUsdCents" IS NULL
  `);
    await exports.prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Card_number_key" ON "Card"("number")
  `);
    await exports.prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Card_userId_idx" ON "Card"("userId")
  `);
    await exports.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CardTransfer" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "fromCardId" TEXT NOT NULL,
      "toCardId" TEXT NOT NULL,
      "amountUsdCents" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
    await exports.prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTransfer_userId_createdAt_idx"
    ON "CardTransfer"("userId", "createdAt")
  `);
    await exports.prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTransfer_fromCardId_createdAt_idx"
    ON "CardTransfer"("fromCardId", "createdAt")
  `);
    await exports.prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CardTransfer_toCardId_createdAt_idx"
    ON "CardTransfer"("toCardId", "createdAt")
  `);
}
