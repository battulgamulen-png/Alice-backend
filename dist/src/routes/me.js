"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../auth");
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
const http_1 = require("../http");
const router = (0, express_1.Router)();
const normalizeCardNumber = (value) => value.replace(/\D/g, "");
async function withSchemaRetry(operation) {
    try {
        return await operation();
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
            await (0, prisma_1.ensureDatabaseSchema)();
            return operation();
        }
        throw err;
    }
}
router.get("/me", async (req, res) => {
    const userId = (0, auth_1.getBearerUserId)(req);
    if (!userId) {
        return (0, http_1.sendJson)(res, 401, { error: "Unauthorized" });
    }
    const user = await prisma_1.prisma.user.findUnique({
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
        return (0, http_1.sendJson)(res, 404, { error: "Not found" });
    }
    return (0, http_1.sendJson)(res, 200, { user });
});
router.put("/me/profile", async (req, res) => {
    const userId = (0, auth_1.getBearerUserId)(req);
    if (!userId) {
        return (0, http_1.sendJson)(res, 401, { error: "Unauthorized" });
    }
    const { firstName, lastName, email, phone } = req.body;
    if (!firstName || !firstName.trim() || !lastName || !lastName.trim() || !email) {
        return (0, http_1.sendJson)(res, 400, { error: "firstName, lastName and email are required" });
    }
    if (!auth_1.emailRegex.test(email.trim())) {
        return (0, http_1.sendJson)(res, 400, { error: "Invalid email" });
    }
    try {
        const user = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
                phone: phone?.trim() || null,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                balanceUsdCents: true,
            },
        });
        return (0, http_1.sendJson)(res, 200, { user });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            return (0, http_1.sendJson)(res, 409, { error: "Email already exists" });
        }
        console.error(err);
        return (0, http_1.sendJson)(res, 500, { error: "Could not update profile" });
    }
});
router.get("/me/cards", async (req, res) => {
    const userId = (0, auth_1.getBearerUserId)(req);
    if (!userId) {
        return (0, http_1.sendJson)(res, 401, { error: "Unauthorized" });
    }
    try {
        const cards = await withSchemaRetry(() => prisma_1.prisma.card.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                holderName: true,
                number: true,
                balanceUsdCents: true,
            },
        }));
        return (0, http_1.sendJson)(res, 200, { cards });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
            return (0, http_1.sendJson)(res, 500, {
                error: "Card table not found in DB. Run DB migration for Card model.",
            });
        }
        console.error(err);
        return (0, http_1.sendJson)(res, 500, { error: "Could not load cards" });
    }
});
router.get("/me/cards/lookup", async (req, res) => {
    const userId = (0, auth_1.getBearerUserId)(req);
    if (!userId) {
        return (0, http_1.sendJson)(res, 401, { error: "Unauthorized" });
    }
    const numberRaw = typeof req.query.number === "string" ? req.query.number : "";
    const number = normalizeCardNumber(numberRaw);
    if (!/^\d{8}$/.test(number)) {
        return (0, http_1.sendJson)(res, 400, { error: "Card number must be exactly 8 digits" });
    }
    try {
        const card = await withSchemaRetry(() => prisma_1.prisma.card.findUnique({
            where: { number },
            select: {
                id: true,
                holderName: true,
                number: true,
                userId: true,
            },
        }));
        if (!card) {
            return (0, http_1.sendJson)(res, 404, { error: "Card not found" });
        }
        return (0, http_1.sendJson)(res, 200, {
            card: {
                id: card.id,
                number: card.number,
                holderName: card.holderName,
                isOwnCard: card.userId === userId,
            },
        });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
            return (0, http_1.sendJson)(res, 500, {
                error: "Card table not found in DB. Run DB migration for Card model.",
            });
        }
        console.error(err);
        return (0, http_1.sendJson)(res, 500, { error: "Could not lookup card" });
    }
});
router.post("/me/cards", async (req, res) => {
    const userId = (0, auth_1.getBearerUserId)(req);
    if (!userId) {
        return (0, http_1.sendJson)(res, 401, { error: "Unauthorized" });
    }
    const { holderName, number } = req.body;
    if (!holderName || !holderName.trim() || !number) {
        return (0, http_1.sendJson)(res, 400, { error: "holderName and number are required" });
    }
    const normalizedNumber = normalizeCardNumber(number);
    if (!/^\d{8}$/.test(normalizedNumber)) {
        return (0, http_1.sendJson)(res, 400, { error: "Card number must be exactly 8 digits" });
    }
    try {
        const card = await withSchemaRetry(() => prisma_1.prisma.card.create({
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
        }));
        return (0, http_1.sendJson)(res, 201, { card });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            return (0, http_1.sendJson)(res, 409, { error: "Card number already exists" });
        }
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
            return (0, http_1.sendJson)(res, 500, {
                error: "Card table not found in DB. Run DB migration for Card model.",
            });
        }
        console.error(err);
        return (0, http_1.sendJson)(res, 500, { error: "Could not create card" });
    }
});
router.post("/me/cards/transfer", async (req, res) => {
    const userId = (0, auth_1.getBearerUserId)(req);
    if (!userId) {
        return (0, http_1.sendJson)(res, 401, { error: "Unauthorized" });
    }
    const { fromCardNumber, toCardNumber, toCardHolder, amountUsd } = req.body;
    if (!fromCardNumber || !toCardNumber || !toCardHolder) {
        return (0, http_1.sendJson)(res, 400, { error: "Missing card info" });
    }
    if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
        return (0, http_1.sendJson)(res, 400, { error: "Invalid amount" });
    }
    const fromNumber = normalizeCardNumber(fromCardNumber);
    const toNumber = normalizeCardNumber(toCardNumber);
    if (!/^\d{8}$/.test(fromNumber) || !/^\d{8}$/.test(toNumber)) {
        return (0, http_1.sendJson)(res, 400, { error: "Card numbers must be exactly 8 digits" });
    }
    if (fromNumber === toNumber) {
        return (0, http_1.sendJson)(res, 400, { error: "From and to cards must be different" });
    }
    const amountCents = Math.round(amountUsd * 100);
    if (amountCents <= 0) {
        return (0, http_1.sendJson)(res, 400, { error: "Invalid amount" });
    }
    try {
        const result = await withSchemaRetry(() => prisma_1.prisma.$transaction(async (tx) => {
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
        }));
        await withSchemaRetry(() => prisma_1.prisma.cardTransfer.create({
            data: {
                userId,
                fromCardId: result.fromCardId,
                toCardId: result.toCardId,
                amountUsdCents: amountCents,
            },
        }));
        return (0, http_1.sendJson)(res, 200, { cards: result.cards });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
            return (0, http_1.sendJson)(res, 500, {
                error: "Card table not found in DB. Run DB migration for Card model.",
            });
        }
        const message = err instanceof Error ? err.message : "Transfer failed";
        if (message === "From card not found" ||
            message === "To card not found" ||
            message === "Card holder does not match" ||
            message === "Insufficient balance") {
            return (0, http_1.sendJson)(res, 400, { error: message });
        }
        console.error(err);
        return (0, http_1.sendJson)(res, 500, { error: "Transfer failed" });
    }
});
router.get("/me/transactions", async (req, res) => {
    const userId = (0, auth_1.getBearerUserId)(req);
    if (!userId) {
        return (0, http_1.sendJson)(res, 401, { error: "Unauthorized" });
    }
    try {
        const transactions = await withSchemaRetry(() => prisma_1.prisma.cardTransfer.findMany({
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
        }));
        return (0, http_1.sendJson)(res, 200, { transactions });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
            return (0, http_1.sendJson)(res, 500, {
                error: "CardTransfer table not found in DB. Run DB migration for CardTransfer model.",
            });
        }
        console.error(err);
        return (0, http_1.sendJson)(res, 500, { error: "Could not load transactions" });
    }
});
exports.default = router;
