"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCompensationIdempotencyKey = exports.buildTransferLegIdempotencyKey = exports.buildInboundWebhookIdempotencyKey = void 0;
const node_crypto_1 = require("node:crypto");
const sha256 = (value) => (0, node_crypto_1.createHash)("sha256").update(value, "utf8").digest("hex");
const buildInboundWebhookIdempotencyKey = (event) => {
    const canonical = [
        event.source,
        event.externalEventId,
        event.accountId,
        event.amountMinor.toString(),
        event.currency,
        event.postedAtIso
    ].join("|");
    return sha256(canonical);
};
exports.buildInboundWebhookIdempotencyKey = buildInboundWebhookIdempotencyKey;
const buildTransferLegIdempotencyKey = (input) => sha256([
    input.executionId,
    input.legId,
    input.destinationAccountId,
    input.amountMinor.toString(),
    input.currency
].join("|"));
exports.buildTransferLegIdempotencyKey = buildTransferLegIdempotencyKey;
const buildCompensationIdempotencyKey = (input) => sha256([
    input.executionId,
    input.legEvent.legId,
    input.legEvent.providerTransferId ?? "NO_PROVIDER_TRANSFER_ID",
    "COMPENSATION"
].join("|"));
exports.buildCompensationIdempotencyKey = buildCompensationIdempotencyKey;
