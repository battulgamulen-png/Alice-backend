import type { NextFunction, Request, Response } from "express";

export type JsonValue = Record<string, unknown>;

export const sendJson = (res: Response, status: number, payload: JsonValue) => {
  res.status(status).json(payload);
};

export const jsonErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof SyntaxError) {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }
  return next(err);
};
