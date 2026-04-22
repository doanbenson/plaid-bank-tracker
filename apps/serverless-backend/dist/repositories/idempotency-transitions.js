"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIdempotencyTransitionAllowed = void 0;
const allowedTransitions = {
    RECEIVED: ["IN_PROGRESS", "FAILED"],
    IN_PROGRESS: ["SUCCEEDED", "FAILED"],
    SUCCEEDED: [],
    FAILED: ["IN_PROGRESS"]
};
const isIdempotencyTransitionAllowed = (fromStatus, toStatus) => allowedTransitions[fromStatus].includes(toStatus);
exports.isIdempotencyTransitionAllowed = isIdempotencyTransitionAllowed;
