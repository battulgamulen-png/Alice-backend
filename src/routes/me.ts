import { Router } from "express";
import { getBearerUserId } from "../auth";
import { Prisma } from "../generated/prisma";
import { ensureDatabaseSchema, prisma } from "../prisma";
import { sendJson } from "../http";

const router = Router();

const normalizeCardNumber = (value: string) => value.replace(/\D/g, "");

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
      balanceUsdCents: true,
    },
  });
  if (!user) {
    return sendJson(res, 404, { error: "Not found" });
  }
  return sendJson(res, 200, { user });
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
        const toCard = await tx.card.findFirst({
          where: {
            userId,
            number: toNumber,
          },
          select: { id: true, holderName: true },
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
