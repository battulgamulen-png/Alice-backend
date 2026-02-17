import { Router } from "express";
import { sendJson } from "../http";

const router = Router();

router.get("/health", (_req, res) => {
  sendJson(res, 200, { ok: true });
});

export default router;
