"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultLithicTransferProvider = exports.MockLithicTransferProvider = exports.buildLithicIdempotentHeaders = void 0;
const node_crypto_1 = require("node:crypto");
const provider_errors_1 = require("../errors/provider-errors");
const buildLithicIdempotentHeaders = (idempotencyKey) => ({
    "Idempotency-Key": idempotencyKey
});
exports.buildLithicIdempotentHeaders = buildLithicIdempotentHeaders;
const deterministicId = (prefix, source) => `${prefix}-${(0, node_crypto_1.createHash)("sha256").update(source, "utf8").digest("hex").slice(0, 16)}`;
class MockLithicTransferProvider {
    async createTransfer(input) {
        if (input.amountMinor <= 0) {
            throw new provider_errors_1.ProviderTerminalError("Amount must be positive", "INVALID_AMOUNT");
        }
        const headers = (0, exports.buildLithicIdempotentHeaders)(input.idempotencyKey);
        return {
            providerTransferId: deterministicId("lithic-transfer", [
                input.executionId,
                input.legId,
                input.sourceAccountId,
                input.destinationAccountId,
                input.amountMinor.toString(),
                input.currency,
                headers["Idempotency-Key"]
            ].join("|"))
        };
    }
    async reverseTransfer(input) {
        if (!input.providerTransferId) {
            throw new provider_errors_1.ProviderTerminalError("Provider transfer id is required", "MISSING_PROVIDER_TRANSFER_ID");
        }
        const headers = (0, exports.buildLithicIdempotentHeaders)(input.idempotencyKey);
        return {
            providerCompensationId: deterministicId("lithic-reversal", [input.executionId, input.legId, input.providerTransferId, input.reason, headers["Idempotency-Key"]].join("|"))
        };
    }
}
exports.MockLithicTransferProvider = MockLithicTransferProvider;
const defaultLithicTransferProvider = new MockLithicTransferProvider();
const getDefaultLithicTransferProvider = () => defaultLithicTransferProvider;
exports.getDefaultLithicTransferProvider = getDefaultLithicTransferProvider;
