import { Router } from "express";
import { getBearerUserId } from "../auth";
import { prisma } from "../prisma";
import { sendJson } from "../http";

const router = Router();

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
    },
  });
  if (!user) {
    return sendJson(res, 404, { error: "Not found" });
  }
  return sendJson(res, 200, { user });
});

export default router;
