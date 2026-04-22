"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propagateExecutionContext = exports.createExecutionContext = exports.extractCorrelationIdFromHeaders = void 0;
const node_crypto_1 = require("node:crypto");
const normalizeIdentifier = (value) => {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
};
const extractCorrelationIdFromHeaders = (headers) => {
    if (!headers) {
        return undefined;
    }
    const matches = Object.entries(headers).find(([headerName]) => ["x-correlation-id", "x-request-id", "x-amzn-trace-id"].includes(headerName.toLowerCase()));
    return normalizeIdentifier(matches?.[1]);
};
exports.extractCorrelationIdFromHeaders = extractCorrelationIdFromHeaders;
const createExecutionContext = (input) => {
    const executionId = normalizeIdentifier(input.executionId);
    const correlationId = normalizeIdentifier(input.correlationId) ??
        executionId ??
        normalizeIdentifier(input.fallbackCorrelationId) ??
        (0, node_crypto_1.randomUUID)();
    return {
        executionId,
        correlationId
    };
};
exports.createExecutionContext = createExecutionContext;
const propagateExecutionContext = (payload, context) => ({
    ...payload,
    executionId: payload.executionId ?? context.executionId,
    correlationId: payload.correlationId ?? context.correlationId
});
exports.propagateExecutionContext = propagateExecutionContext;
