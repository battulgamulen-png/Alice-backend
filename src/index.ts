import "dotenv/config";
import * as http from "http";
import { URL } from "url";
import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { prisma } from "./prisma";
import { Prisma } from "./generated/prisma";

type JsonValue = Record<string, unknown>;

type JwtPayload = {
  sub: string;
  email: string;
};

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

if (!JWT_SECRET) {
  console.warn("JWT_SECRET is not set. Auth will fail.");
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (userId: string, email: string) =>
  jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const readBody = (req: http.IncomingMessage): Promise<JsonValue> =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data) as JsonValue);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

const sendJson = (
  res: http.ServerResponse,
  status: number,
  payload: JsonValue,
) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const sendCors = (res: http.ServerResponse) => {
  const allowed = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : ["http://localhost:3000"];
  res.setHeader("Access-Control-Allow-Origin", allowed.join(","));
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
};

const getBearerUserId = (req: http.IncomingMessage): string | null => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return payload.sub;
  } catch {
    return null;
  }
};

const server = http.createServer(async (req, res) => {
  sendCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const method = req.method || "GET";
  const url = new URL(req.url || "/", "http://localhost");

  if (method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (method === "POST" && url.pathname === "/auth/signup") {
    let body: JsonValue;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON" });
    }

    const { firstName, lastName, email, password, phone } = body as {
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
  }

  if (method === "POST" && url.pathname === "/auth/login") {
    let body: JsonValue;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON" });
    }

    const { email, password } = body as { email?: string; password?: string };

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
  }

  if (method === "GET" && url.pathname === "/me") {
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
      },
    });
    if (!user) {
      return sendJson(res, 404, { error: "Not found" });
    }
    return sendJson(res, 200, { user });
  }

  return sendJson(res, 404, { error: "Not found" });
});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
