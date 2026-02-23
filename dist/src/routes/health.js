"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const http_1 = require("../http");
const router = (0, express_1.Router)();
router.get("/health", (_req, res) => {
    (0, http_1.sendJson)(res, 200, { ok: true });
});
exports.default = router;
