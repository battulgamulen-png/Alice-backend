import "dotenv/config";
import express from "express";
import cors from "cors";
import { jsonErrorHandler, sendJson } from "./http";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";
import meRouter from "./routes/me";

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
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
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
