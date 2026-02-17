import type { Request } from "express";
import * as jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

type JwtPayload = {
  sub: string;
  email: string;
};

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ||
  "7d") as SignOptions["expiresIn"];

if (!JWT_SECRET) {
  console.warn("JWT_SECRET is not set. Auth will fail.");
}

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signToken = (userId: string, email: string) =>
  jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

export const getBearerUserId = (req: Request): string | null => {
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
