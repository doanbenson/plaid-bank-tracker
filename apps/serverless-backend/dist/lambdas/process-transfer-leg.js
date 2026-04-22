"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.createHandler = void 0;
const node_crypto_1 = require("node:crypto");
const provider_errors_1 = require("../errors/provider-errors");
const key_builders_1 = require("../idempotency/key-builders");
const execution_context_1 = require("../observability/execution-context");
const metrics_alarms_1 = require("../observability/metrics-alarms");
const structured_logger_1 = require("../observability/structured-logger");
const in_memory_banking_core_repositories_1 = require("../repositories/in-memory-banking-core-repositories");
const lithic_transfer_provider_1 = require("../providers/lithic-transfer-provider");
const inMemoryDefaultRepositories = (0, in_memory_banking_core_repositories_1.createInMemoryBankingCoreRepositories)();
const defaultDependencies = {
    repositories: {
        executions: inMemoryDefaultRepositories.executions,
        idempotency: inMemoryDefaultRepositories.idempotency,
        audit: inMemoryDefaultRepositories.audit
    },
    provider: (0, lithic_transfer_provider_1.getDefaultLithicTransferProvider)(),
    now: () => new Date()
};
const logger = (0, structured_logger_1.createStructuredLogger)({
    service: "serverless-backend",
    component: "process-transfer-leg"
});
const hashPayload = (value) => (0, node_crypto_1.createHash)("sha256").update(JSON.stringify(value), "utf8").digest("hex");
const toDayKey = (iso) => iso.slice(0, 10).replace(/-/g, "");
const ensureTransferIdempotencyLock = async (repository, record) => {
    const existing = await repository.get("transfer", record.key);
    if (!existing) {
        await repository.claimIfAbsent(record);
        return "ACQUIRED";
    }
    if (existing.status === "SUCCEEDED") {
        return "ALREADY_SUCCEEDED";
    }
    if (existing.status === "IN_PROGRESS") {
        throw new provider_errors_1.TransferTransientError("Transfer leg idempotency lock already in progress");
    }
    const transitioned = await repository.transitionStatus({
        scope: "transfer",
        key: record.key,
        fromStatus: existing.status,
        toStatus: "IN_PROGRESS",
        updatedAtIso: record.updatedAtIso,
        linkedExecutionId: record.linkedExecutionId,
        responseHash: undefined
    });
    if (!transitioned) {
        throw new provider_errors_1.TransferTransientError("Unable to reacquire transfer idempotency lock");
    }
    return "ACQUIRED";
};
const createHandler = (dependencies = defaultDependencies) => {
    return async (event) => {
        const timestampIso = dependencies.now().toISOString();
        const executionContext = (0, execution_context_1.createExecutionContext)({
            executionId: event.executionId,
            correlationId: event.correlationId
        });
        const transferEvent = (0, execution_context_1.propagateExecutionContext)(event, executionContext);
        const transferIdempotencyKey = transferEvent.leg.idempotencyKey ||
            (0, key_builders_1.buildTransferLegIdempotencyKey)({
                executionId: transferEvent.executionId,
                legId: transferEvent.leg.legId,
                destinationAccountId: transferEvent.leg.destinationAccountId,
                amountMinor: transferEvent.leg.amountMinor,
                currency: transferEvent.currency
            });
        if (transferEvent.leg.amountMinor <= 0) {
            logger.error("Transfer leg failed validation", {
                classification: "EXECUTION_FAILED",
                executionContext,
                legId: transferEvent.leg.legId,
                metricName: metrics_alarms_1.OBSERVABILITY_METRICS.failedExecutions.metricName,
                metricValue: 1,
                reason: "INVALID_AMOUNT"
            });
            return {
                executionId: transferEvent.executionId,
                legId: transferEvent.leg.legId,
                status: "FAILED",
                reason: "INVALID_AMOUNT",
                transferIdempotencyKey,
                correlationId: executionContext.correlationId
            };
        }
        const requestHash = hashPayload({
            executionId: transferEvent.executionId,
            sourceAccountId: transferEvent.sourceAccountId,
            leg: transferEvent.leg,
            currency: transferEvent.currency
        });
        const lockState = await ensureTransferIdempotencyLock(dependencies.repositories.idempotency, {
            scope: "transfer",
            key: transferIdempotencyKey,
            status: "IN_PROGRESS",
            requestHash,
            linkedExecutionId: transferEvent.executionId,
            createdAtIso: timestampIso,
            updatedAtIso: timestampIso
        });
        if (lockState === "ALREADY_SUCCEEDED") {
            logger.info("Transfer leg replay detected via idempotency lock", {
                executionContext,
                legId: transferEvent.leg.legId,
                transferIdempotencyKey
            });
            return {
                executionId: transferEvent.executionId,
                legId: transferEvent.leg.legId,
                status: "SUCCEEDED",
                reason: "IDEMPOTENT_REPLAY",
                transferIdempotencyKey,
                correlationId: executionContext.correlationId
            };
        }
        await dependencies.repositories.executions.transitionExecutionStatus({
            executionId: transferEvent.executionId,
            fromStatus: "PENDING",
            toStatus: "IN_PROGRESS",
            updatedAtIso: timestampIso
        });
        await dependencies.repositories.executions.transitionTransferLegStatus({
            executionId: transferEvent.executionId,
            legId: transferEvent.leg.legId,
            fromStatus: "PENDING",
            toStatus: "IN_PROGRESS",
            updatedAtIso: timestampIso
        });
        try {
            logger.info("Starting transfer leg execution", {
                executionContext,
                legId: transferEvent.leg.legId,
                transferIdempotencyKey
            });
            const providerResult = await dependencies.provider.createTransfer({
                executionId: transferEvent.executionId,
                legId: transferEvent.leg.legId,
                sourceAccountId: transferEvent.sourceAccountId,
                destinationAccountId: transferEvent.leg.destinationAccountId,
                amountMinor: transferEvent.leg.amountMinor,
                currency: transferEvent.currency,
                idempotencyKey: transferIdempotencyKey
            });
            await dependencies.repositories.executions.transitionTransferLegStatus({
                executionId: transferEvent.executionId,
                legId: transferEvent.leg.legId,
                fromStatus: "IN_PROGRESS",
                toStatus: "SUCCEEDED",
                updatedAtIso: timestampIso,
                providerTransferId: providerResult.providerTransferId
            });
            await dependencies.repositories.idempotency.transitionStatus({
                scope: "transfer",
                key: transferIdempotencyKey,
                fromStatus: "IN_PROGRESS",
                toStatus: "SUCCEEDED",
                updatedAtIso: timestampIso,
                responseHash: hashPayload(providerResult),
                linkedExecutionId: transferEvent.executionId
            });
            await dependencies.repositories.audit.append({
                day: toDayKey(timestampIso),
                executionId: transferEvent.executionId,
                step: "TRANSFER_EXECUTED",
                timestampIso,
                detail: {
                    legId: transferEvent.leg.legId,
                    providerTransferId: providerResult.providerTransferId,
                    transferIdempotencyKey
                }
            });
            logger.info("Transfer leg execution succeeded", {
                executionContext,
                legId: transferEvent.leg.legId,
                providerTransferId: providerResult.providerTransferId,
                transferIdempotencyKey
            });
            return {
                executionId: transferEvent.executionId,
                legId: transferEvent.leg.legId,
                status: "SUCCEEDED",
                providerTransferId: providerResult.providerTransferId,
                transferIdempotencyKey,
                correlationId: executionContext.correlationId
            };
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : "TRANSFER_PROVIDER_ERROR";
            await dependencies.repositories.executions.transitionTransferLegStatus({
                executionId: transferEvent.executionId,
                legId: transferEvent.leg.legId,
                fromStatus: "IN_PROGRESS",
                toStatus: "FAILED",
                updatedAtIso: timestampIso,
                reason
            });
            await dependencies.repositories.idempotency.transitionStatus({
                scope: "transfer",
                key: transferIdempotencyKey,
                fromStatus: "IN_PROGRESS",
                toStatus: "FAILED",
                updatedAtIso: timestampIso,
                responseHash: hashPayload({ reason }),
                linkedExecutionId: transferEvent.executionId
            });
            if (error instanceof provider_errors_1.TransferTransientError) {
                logger.error("Transfer leg encountered idempotency conflict", {
                    classification: "IDEMPOTENCY_CONFLICT",
                    executionContext,
                    legId: transferEvent.leg.legId,
                    transferIdempotencyKey,
                    error
                });
                throw error;
            }
            if (error instanceof provider_errors_1.ProviderTransientError) {
                logger.error("Transfer leg encountered retryable provider error", {
                    classification: "PROVIDER_TRANSIENT",
                    executionContext,
                    legId: transferEvent.leg.legId,
                    transferIdempotencyKey,
                    error
                });
                throw new provider_errors_1.TransferTransientError(error.message);
            }
            if (error instanceof provider_errors_1.ProviderError) {
                logger.error("Transfer leg encountered terminal provider error", {
                    classification: "PROVIDER_TERMINAL",
                    executionContext,
                    legId: transferEvent.leg.legId,
                    transferIdempotencyKey,
                    metricName: metrics_alarms_1.OBSERVABILITY_METRICS.failedExecutions.metricName,
                    metricValue: 1,
                    error
                });
                return {
                    executionId: transferEvent.executionId,
                    legId: transferEvent.leg.legId,
                    status: "FAILED",
                    reason: error.code,
                    transferIdempotencyKey,
                    correlationId: executionContext.correlationId
                };
            }
            logger.error("Transfer leg encountered unexpected error", {
                classification: "UNEXPECTED",
                executionContext,
                legId: transferEvent.leg.legId,
                transferIdempotencyKey,
                metricName: metrics_alarms_1.OBSERVABILITY_METRICS.failedExecutions.metricName,
                metricValue: 1,
                error
            });
            return {
                executionId: transferEvent.executionId,
                legId: transferEvent.leg.legId,
                status: "FAILED",
                reason,
                transferIdempotencyKey,
                correlationId: executionContext.correlationId
            };
        }
    };
};
exports.createHandler = createHandler;
exports.handler = (0, exports.createHandler)();
