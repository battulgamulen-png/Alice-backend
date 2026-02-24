"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("./http");
const auth_1 = __importDefault(require("./routes/auth"));
const health_1 = __importDefault(require("./routes/health"));
const me_1 = __importDefault(require("./routes/me"));
const prisma_1 = require("./prisma");
const app = (0, express_1.default)();
const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : ["http://localhost:3000"];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        const isConfigured = configuredOrigins.includes(origin);
        const isLocalhost = origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000";
        const isVercel = origin.endsWith(".vercel.app");
        if (isConfigured || isLocalhost || isVercel) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(express_1.default.json({ limit: "5mb" }));
app.use(http_1.jsonErrorHandler);
app.use(health_1.default);
app.use(auth_1.default);
app.use(me_1.default);
app.use((_req, res) => {
    (0, http_1.sendJson)(res, 404, { error: "Not found" });
});
const port = Number(process.env.PORT || 4000);
async function start() {
    await (0, prisma_1.ensureDatabaseSchema)();
    app.listen(port, () => {
        console.log(`API listening on http://localhost:${port}`);
    });
}
start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
