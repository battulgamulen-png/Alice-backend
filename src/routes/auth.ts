import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { emailRegex, signToken } from "../auth";
import { sendJson } from "../http";

const router = Router();

const normalizeCardNumber = (value: string) => value.replace(/\D/g, "");

router.post("/auth/signup", async (req, res) => {
  const { firstName, lastName, email, password, phone, cardNumber } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    phone?: string;
    cardNumber?: string;
  };

  if (!firstName || !lastName || !email || !password || !cardNumber) {
    return sendJson(res, 400, { error: "Missing required fields" });
  }
  if (!emailRegex.test(email)) {
    return sendJson(res, 400, { error: "Invalid email" });
  }
  if (password.length < 6) {
    return sendJson(res, 400, {
      error: "Password must be at least 6 characters",
    });
  }
  const normalizedCardNumber = normalizeCardNumber(cardNumber);
  if (!/^\d{8}$/.test(normalizedCardNumber)) {
    return sendJson(res, 400, { error: "Card number must be exactly 8 digits" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) => {
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

    const token = signToken(user.id, user.email);
    return sendJson(res, 201, { user, token });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        const target = Array.isArray(err.meta?.target) ? err.meta?.target.join(",") : "";
        if (target.includes("email")) {
          return sendJson(res, 409, { error: "Email already exists" });
        }
        if (target.includes("number")) {
          return sendJson(res, 409, { error: "Card number already exists" });
        }
        return sendJson(res, 409, { error: "Duplicate value" });
      }
    }
    console.error(err);
    return sendJson(res, 500, { error: "Server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return sendJson(res, 400, { error: "Missing email or password" });
  }

  const user = await prisma.user.findUnique({
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
    return sendJson(res, 401, { error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return sendJson(res, 401, { error: "Invalid credentials" });
  }

  const token = signToken(user.id, user.email);
  const { passwordHash, ...safeUser } = user;
  return sendJson(res, 200, { user: safeUser, token });
});

router.post("/auth/forgot-password", async (req, res) => {
  const { email, phone, newPassword } = req.body as {
    email?: string;
    phone?: string;
    newPassword?: string;
  };

  if (!email || !phone || !newPassword) {
    return sendJson(res, 400, { error: "Missing email, phone, or new password" });
  }
  if (!emailRegex.test(email)) {
    return sendJson(res, 400, { error: "Invalid email" });
  }
  if (newPassword.length < 6) {
    return sendJson(res, 400, {
      error: "Password must be at least 6 characters",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, phone: true },
  });

  if (!user || !user.phone || user.phone.trim() !== phone.trim()) {
    return sendJson(res, 401, { error: "Email or phone does not match" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return sendJson(res, 200, { message: "Password updated successfully" });
});

export default router;
