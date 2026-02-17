import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "../generated/prisma";
import { prisma } from "../prisma";
import { emailRegex, signToken } from "../auth";
import { sendJson } from "../http";

const router = Router();

router.post("/auth/signup", async (req, res) => {
  const { firstName, lastName, email, password, phone } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    phone?: string;
  };

  if (!firstName || !lastName || !email || !password) {
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

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        passwordHash,
        phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    const token = signToken(user.id, user.email);
    return sendJson(res, 201, { user, token });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return sendJson(res, 409, { error: "Email already exists" });
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

export default router;
