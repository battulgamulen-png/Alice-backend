"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonErrorHandler = exports.sendJson = void 0;
const sendJson = (res, status, payload) => {
    res.status(status).json(payload);
};
exports.sendJson = sendJson;
const jsonErrorHandler = (err, _req, res, next) => {
    if (err instanceof SyntaxError) {
        return (0, exports.sendJson)(res, 400, { error: "Invalid JSON" });
    }
    return next(err);
};
exports.jsonErrorHandler = jsonErrorHandler;
