import "dotenv/config";
import express from "express";
import cors from "cors";
import { jsonErrorHandler, sendJson } from "./http";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import meRouter from "./routes/me";
import { ensureDatabaseSchema } from "./prisma";

const app = express();
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isConfigured = configuredOrigins.includes(origin);
      const isLocalhost =
        origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000";
      const isVercel = origin.endsWith(".vercel.app");

      if (isConfigured || isLocalhost || isVercel) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use(express.json());

app.use(jsonErrorHandler);
app.use(healthRouter);
app.use(authRouter);
app.use(meRouter);

app.use((_req, res) => {
  sendJson(res, 404, { error: "Not found" });
});

const port = Number(process.env.PORT || 4000);

async function start() {
  await ensureDatabaseSchema();
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
