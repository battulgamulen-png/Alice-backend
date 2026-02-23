"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
const auth_1 = require("../auth");
const http_1 = require("../http");
const router = (0, express_1.Router)();
const normalizeCardNumber = (value) => value.replace(/\D/g, "");
router.post("/auth/signup", async (req, res) => {
    const { firstName, lastName, email, password, phone, cardNumber } = req.body;
    if (!firstName || !lastName || !email || !password || !cardNumber) {
        return (0, http_1.sendJson)(res, 400, { error: "Missing required fields" });
    }
    if (!auth_1.emailRegex.test(email)) {
        return (0, http_1.sendJson)(res, 400, { error: "Invalid email" });
    }
    if (password.length < 6) {
        return (0, http_1.sendJson)(res, 400, {
            error: "Password must be at least 6 characters",
        });
    }
    const normalizedCardNumber = normalizeCardNumber(cardNumber);
    if (!/^\d{8}$/.test(normalizedCardNumber)) {
        return (0, http_1.sendJson)(res, 400, { error: "Card number must be exactly 8 digits" });
    }
    try {
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    firstName,
                    lastName,
                    email: email.toLowerCase(),
                    passwordHash,
                    phone,
                    balanceUsdCents: 100000,
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
            await tx.card.create({
                data: {
                    userId: created.id,
                    holderName: `${created.firstName} ${created.lastName}`.trim(),
                    number: normalizedCardNumber,
                    balanceUsdCents: created.balanceUsdCents,
                },
            });
            return created;
        });
        const token = (0, auth_1.signToken)(user.id, user.email);
        return (0, http_1.sendJson)(res, 201, { user, token });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            if (err.code === "P2002") {
                const target = Array.isArray(err.meta?.target) ? err.meta?.target.join(",") : "";
                if (target.includes("email")) {
                    return (0, http_1.sendJson)(res, 409, { error: "Email already exists" });
                }
                if (target.includes("number")) {
                    return (0, http_1.sendJson)(res, 409, { error: "Card number already exists" });
                }
                return (0, http_1.sendJson)(res, 409, { error: "Duplicate value" });
            }
        }
        console.error(err);
        return (0, http_1.sendJson)(res, 500, { error: "Server error" });
    }
});
router.post("/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return (0, http_1.sendJson)(res, 400, { error: "Missing email or password" });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            balanceUsdCents: true,
            passwordHash: true,
        },
    });
    if (!user) {
        return (0, http_1.sendJson)(res, 401, { error: "Invalid credentials" });
    }
    const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!ok) {
        return (0, http_1.sendJson)(res, 401, { error: "Invalid credentials" });
    }
    const token = (0, auth_1.signToken)(user.id, user.email);
    const { passwordHash, ...safeUser } = user;
    return (0, http_1.sendJson)(res, 200, { user: safeUser, token });
});
router.post("/auth/forgot-password", async (req, res) => {
    const { email, phone, newPassword } = req.body;
    if (!email || !phone || !newPassword) {
        return (0, http_1.sendJson)(res, 400, { error: "Missing email, phone, or new password" });
    }
    if (!auth_1.emailRegex.test(email)) {
        return (0, http_1.sendJson)(res, 400, { error: "Invalid email" });
    }
    if (newPassword.length < 6) {
        return (0, http_1.sendJson)(res, 400, {
            error: "Password must be at least 6 characters",
        });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, phone: true },
    });
    if (!user || !user.phone || user.phone.trim() !== phone.trim()) {
        return (0, http_1.sendJson)(res, 401, { error: "Email or phone does not match" });
    }
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
    });
    return (0, http_1.sendJson)(res, 200, { message: "Password updated successfully" });
});
exports.default = router;
