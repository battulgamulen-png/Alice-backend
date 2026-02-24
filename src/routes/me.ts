import { Router } from "express";
import { emailRegex, getBearerUserId } from "../auth";
import { Prisma } from "@prisma/client";
import { ensureDatabaseSchema, prisma } from "../prisma";
import { sendJson } from "../http";

const router = Router();

const normalizeCardNumber = (value: string) => value.replace(/\D/g, "");
const normalizeCurrency = (value?: string) => {
  const upper = (value || "").trim().toUpperCase();
  if (upper === "USD" || upper === "EUR") return upper;
  return "MNT";
};

async function withSchemaRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      await ensureDatabaseSchema();
      return operation();
    }
    throw err;
  }
}

router.get("/me", async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
      nationalId: true,
      kycStatus: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      country: true,
      postalCode: true,
      preferredCurrency: true,
      marketingOptIn: true,
      twoFactorEnabled: true,
      balanceUsdCents: true,
    },
  });
  if (!user) {
    return sendJson(res, 404, { error: "Not found" });
  }
  return sendJson(res, 200, { user });
});

router.put("/me/profile", async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    avatarUrl,
    nationalId,
    kycStatus,
    addressLine1,
    addressLine2,
    city,
    country,
    postalCode,
    preferredCurrency,
    marketingOptIn,
    twoFactorEnabled,
  } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    nationalId?: string;
    kycStatus?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    country?: string;
    postalCode?: string;
    preferredCurrency?: string;
    marketingOptIn?: boolean;
    twoFactorEnabled?: boolean;
  };

  if (!firstName || !firstName.trim() || !lastName || !lastName.trim() || !email) {
    return sendJson(res, 400, { error: "firstName, lastName and email are required" });
  }
  if (!emailRegex.test(email.trim())) {
    return sendJson(res, 400, { error: "Invalid email" });
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        avatarUrl: avatarUrl?.trim() || null,
        nationalId: nationalId?.trim() || null,
        kycStatus:
          kycStatus === "Verified" || kycStatus === "Not Verified" ? kycStatus : "Pending",
        addressLine1: addressLine1?.trim() || null,
        addressLine2: addressLine2?.trim() || null,
        city: city?.trim() || null,
        country: country?.trim() || null,
        postalCode: postalCode?.trim() || null,
        preferredCurrency: normalizeCurrency(preferredCurrency),
        marketingOptIn: Boolean(marketingOptIn),
        twoFactorEnabled:
          typeof twoFactorEnabled === "boolean" ? twoFactorEnabled : true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        nationalId: true,
        kycStatus: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        country: true,
        postalCode: true,
        preferredCurrency: true,
        marketingOptIn: true,
        twoFactorEnabled: true,
        balanceUsdCents: true,
      },
    });

    return sendJson(res, 200, { user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendJson(res, 409, { error: "Email already exists" });
    }
    console.error(err);
    return sendJson(res, 500, { error: "Could not update profile" });
  }
});

router.get("/me/cards", async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  try {
    const cards = await withSchemaRetry(() =>
      prisma.card.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          holderName: true,
          number: true,
          balanceUsdCents: true,
        },
      }),
    );

    return sendJson(res, 200, { cards });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return sendJson(res, 500, {
        error: "Card table not found in DB. Run DB migration for Card model.",
      });
    }
    console.error(err);
    return sendJson(res, 500, { error: "Could not load cards" });
  }
});

router.get("/me/cards/lookup", async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const numberRaw = typeof req.query.number === "string" ? req.query.number : "";
  const number = normalizeCardNumber(numberRaw);
  if (!/^\d{8}$/.test(number)) {
    return sendJson(res, 400, { error: "Card number must be exactly 8 digits" });
  }

  try {
    const card = await withSchemaRetry(() =>
      prisma.card.findUnique({
        where: { number },
        select: {
          id: true,
          holderName: true,
          number: true,
          userId: true,
        },
      }),
    );

    if (!card) {
      return sendJson(res, 404, { error: "Card not found" });
    }

    return sendJson(res, 200, {
      card: {
        id: card.id,
        number: card.number,
        holderName: card.holderName,
        isOwnCard: card.userId === userId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return sendJson(res, 500, {
        error: "Card table not found in DB. Run DB migration for Card model.",
      });
    }
    console.error(err);
    return sendJson(res, 500, { error: "Could not lookup card" });
  }
});

router.post("/me/cards", async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const { holderName, number } = req.body as { holderName?: string; number?: string };
  if (!holderName || !holderName.trim() || !number) {
    return sendJson(res, 400, { error: "holderName and number are required" });
  }
  const normalizedNumber = normalizeCardNumber(number);
  if (!/^\d{8}$/.test(normalizedNumber)) {
    return sendJson(res, 400, { error: "Card number must be exactly 8 digits" });
  }

  try {
    const card = await withSchemaRetry(() =>
      prisma.card.create({
        data: {
          userId,
          holderName: holderName.trim(),
          number: normalizedNumber,
        },
        select: {
          id: true,
          holderName: true,
          number: true,
          balanceUsdCents: true,
        },
      }),
    );
    return sendJson(res, 201, { card });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return sendJson(res, 409, { error: "Card number already exists" });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return sendJson(res, 500, {
        error: "Card table not found in DB. Run DB migration for Card model.",
      });
    }
    console.error(err);
    return sendJson(res, 500, { error: "Could not create card" });
  }
});

router.post("/me/cards/transfer", async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const { fromCardNumber, toCardNumber, toCardHolder, amountUsd } = req.body as {
    fromCardNumber?: string;
    toCardNumber?: string;
    toCardHolder?: string;
    amountUsd?: number;
  };

  if (!fromCardNumber || !toCardNumber || !toCardHolder) {
    return sendJson(res, 400, { error: "Missing card info" });
  }
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return sendJson(res, 400, { error: "Invalid amount" });
  }

  const fromNumber = normalizeCardNumber(fromCardNumber);
  const toNumber = normalizeCardNumber(toCardNumber);
  if (!/^\d{8}$/.test(fromNumber) || !/^\d{8}$/.test(toNumber)) {
    return sendJson(res, 400, { error: "Card numbers must be exactly 8 digits" });
  }
  if (fromNumber === toNumber) {
    return sendJson(res, 400, { error: "From and to cards must be different" });
  }

  const amountCents = Math.round(amountUsd * 100);
  if (amountCents <= 0) {
    return sendJson(res, 400, { error: "Invalid amount" });
  }

  try {
    const result = await withSchemaRetry(() =>
      prisma.$transaction(async (tx) => {
        const fromCard = await tx.card.findFirst({
          where: { userId, number: fromNumber },
          select: { id: true, balanceUsdCents: true },
        });
        if (!fromCard) {
          throw new Error("From card not found");
        }
        const toCard = await tx.card.findUnique({
          where: {
            number: toNumber,
          },
          select: { id: true, holderName: true, userId: true },
        });
        if (!toCard) {
          throw new Error("To card not found");
        }
        if (toCard.holderName.trim().toLowerCase() !== toCardHolder.trim().toLowerCase()) {
          throw new Error("Card holder does not match");
        }
        if (fromCard.balanceUsdCents < amountCents) {
          throw new Error("Insufficient balance");
        }

        await tx.card.update({
          where: { id: fromCard.id },
          data: { balanceUsdCents: { decrement: amountCents } },
        });
        await tx.card.update({
          where: { id: toCard.id },
          data: { balanceUsdCents: { increment: amountCents } },
        });
        await tx.user.update({
          where: { id: userId },
          data: { balanceUsdCents: { decrement: amountCents } },
        });
        await tx.user.update({
          where: { id: toCard.userId },
          data: { balanceUsdCents: { increment: amountCents } },
        });

        const cards = await tx.card.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            holderName: true,
            number: true,
            balanceUsdCents: true,
          },
        });
        return { cards, fromCardId: fromCard.id, toCardId: toCard.id };
      }),
    );

    await withSchemaRetry(() =>
      prisma.cardTransfer.create({
        data: {
          userId,
          fromCardId: result.fromCardId,
          toCardId: result.toCardId,
          amountUsdCents: amountCents,
        },
      }),
    );

    return sendJson(res, 200, { cards: result.cards });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return sendJson(res, 500, {
        error: "Card table not found in DB. Run DB migration for Card model.",
      });
    }
    const message = err instanceof Error ? err.message : "Transfer failed";
    if (
      message === "From card not found" ||
      message === "To card not found" ||
      message === "Card holder does not match" ||
      message === "Insufficient balance"
    ) {
      return sendJson(res, 400, { error: message });
    }
    console.error(err);
    return sendJson(res, 500, { error: "Transfer failed" });
  }
});

router.get("/me/transactions", async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  try {
    const transactions = await withSchemaRetry(() =>
      prisma.cardTransfer.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          amountUsdCents: true,
          createdAt: true,
          fromCard: {
            select: {
              id: true,
              holderName: true,
              number: true,
            },
          },
          toCard: {
            select: {
              id: true,
              holderName: true,
              number: true,
            },
          },
        },
      }),
    );

    return sendJson(res, 200, { transactions });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return sendJson(res, 500, {
        error: "CardTransfer table not found in DB. Run DB migration for CardTransfer model.",
      });
    }
    console.error(err);
    return sendJson(res, 500, { error: "Could not load transactions" });
  }
});

export default router;
