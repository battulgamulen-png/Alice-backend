CREATE TABLE IF NOT EXISTS "Card" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "holderName" TEXT NOT NULL,
  "number" TEXT NOT NULL UNIQUE,
  "balanceUsdCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Card_userId_idx" ON "Card"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Card_number_8_digits_chk'
  ) THEN
    ALTER TABLE "Card"
      ADD CONSTRAINT "Card_number_8_digits_chk"
      CHECK ("number" ~ '^[0-9]{8}$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Card_userId_fkey'
  ) THEN
    ALTER TABLE "Card"
      ADD CONSTRAINT "Card_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'balanceusdcents'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'balanceUsdCents'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN balanceusdcents TO "balanceUsdCents";
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "balanceUsdCents" INTEGER;

UPDATE "User"
SET "balanceUsdCents" = 100000
WHERE "balanceUsdCents" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "balanceUsdCents" SET NOT NULL;

ALTER TABLE "User"
  ALTER COLUMN "balanceUsdCents" SET DEFAULT 100000;

CREATE TABLE IF NOT EXISTS "CardTransfer" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "fromCardId" TEXT NOT NULL,
  "toCardId" TEXT NOT NULL,
  "amountUsdCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CardTransfer_userId_createdAt_idx"
  ON "CardTransfer"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CardTransfer_fromCardId_createdAt_idx"
  ON "CardTransfer"("fromCardId", "createdAt");
CREATE INDEX IF NOT EXISTS "CardTransfer_toCardId_createdAt_idx"
  ON "CardTransfer"("toCardId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CardTransfer_userId_fkey'
  ) THEN
    ALTER TABLE "CardTransfer"
      ADD CONSTRAINT "CardTransfer_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CardTransfer_fromCardId_fkey'
  ) THEN
    ALTER TABLE "CardTransfer"
      ADD CONSTRAINT "CardTransfer_fromCardId_fkey"
      FOREIGN KEY ("fromCardId") REFERENCES "Card"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CardTransfer_toCardId_fkey'
  ) THEN
    ALTER TABLE "CardTransfer"
      ADD CONSTRAINT "CardTransfer_toCardId_fkey"
      FOREIGN KEY ("toCardId") REFERENCES "Card"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
