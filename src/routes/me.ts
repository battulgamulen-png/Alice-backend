import { Router } from "express";
import { emailRegex, getBearerUserId } from "../auth";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureDatabaseSchema, prisma } from "../prisma";
import { sendJson } from "../http";

const router = Router();

const normalizeCardNumber = (value: string) => value.replace(/\D/g, "");
const normalizeCurrency = (value?: string) => {
  const upper = (value || "").trim().toUpperCase();
  if (upper === "USD" || upper === "EUR") return upper;
  return "MNT";
};
const normalizeLanguage = (value?: string) => {
  const upper = (value || "").trim().toUpperCase();
  return upper === "EN" ? "EN" : "MN";
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
      language: true,
      loginAlerts: true,
      emailNotifications: true,
      smsNotifications: true,
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
    language,
    loginAlerts,
    emailNotifications,
    smsNotifications,
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
    language?: string;
    loginAlerts?: boolean;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
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
          typeof kycStatus === "string"
            ? kycStatus === "Verified" || kycStatus === "Not Verified"
              ? kycStatus
              : "Pending"
            : undefined,
        addressLine1: addressLine1?.trim() || null,
        addressLine2: addressLine2?.trim() || null,
        city: city?.trim() || null,
        country: country?.trim() || null,
        postalCode: postalCode?.trim() || null,
        preferredCurrency:
          typeof preferredCurrency === "string"
            ? normalizeCurrency(preferredCurrency)
            : undefined,
        marketingOptIn:
          typeof marketingOptIn === "boolean" ? marketingOptIn : undefined,
        twoFactorEnabled:
          typeof twoFactorEnabled === "boolean" ? twoFactorEnabled : undefined,
        language: typeof language === "string" ? normalizeLanguage(language) : undefined,
        loginAlerts: typeof loginAlerts === "boolean" ? loginAlerts : undefined,
        emailNotifications:
          typeof emailNotifications === "boolean" ? emailNotifications : undefined,
        smsNotifications:
          typeof smsNotifications === "boolean" ? smsNotifications : undefined,
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
        language: true,
        loginAlerts: true,
        emailNotifications: true,
        smsNotifications: true,
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

router.put("/me/password", async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    return sendJson(res, 400, { error: "currentPassword and newPassword are required" });
  }
  if (newPassword.length < 6) {
    return sendJson(res, 400, { error: "Password must be at least 6 characters" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    return sendJson(res, 404, { error: "User not found" });
  }
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return sendJson(res, 401, { error: "Current password is incorrect" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
  return sendJson(res, 200, { message: "Password updated successfully" });
});

router.delete("/me", async (req, res) => {
  const userId = getBearerUserId(req);
  if (!userId) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }
  await prisma.$transaction(async (tx) => {
    const cards = await tx.card.findMany({
      where: { userId },
      select: { id: true },
    });
    const cardIds = cards.map((c) => c.id);

    if (cardIds.length > 0) {
      await tx.cardTransfer.deleteMany({
        where: {
          OR: [
            { userId },
            { fromCardId: { in: cardIds } },
            { toCardId: { in: cardIds } },
          ],
        },
      });
    } else {
      await tx.cardTransfer.deleteMany({ where: { userId } });
    }

    await tx.card.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
  return sendJson(res, 200, { message: "Account deleted" });
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
    const transactionsRaw = await withSchemaRetry(() =>
      prisma.cardTransfer.findMany({
        where: {
          OR: [{ fromCard: { userId } }, { toCard: { userId } }],
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          amountUsdCents: true,
          createdAt: true,
          fromCard: {
            select: {
              id: true,
              userId: true,
              holderName: true,
              number: true,
            },
          },
          toCard: {
            select: {
              id: true,
              userId: true,
              holderName: true,
              number: true,
            },
          },
        },
      }),
    );

    const transactions = transactionsRaw.map((tx) => {
      const direction = tx.toCard.userId === userId ? "incoming" : "outgoing";
      return { ...tx, direction };
    });

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
