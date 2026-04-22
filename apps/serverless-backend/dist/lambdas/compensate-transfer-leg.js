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
    component: "compensate-transfer-leg"
});
const hashPayload = (value) => (0, node_crypto_1.createHash)("sha256").update(JSON.stringify(value), "utf8").digest("hex");
const toDayKey = (iso) => iso.slice(0, 10).replace(/-/g, "");
const ensureCompensationIdempotencyLock = async (repository, record) => {
    const existing = await repository.get("compensation", record.key);
    if (!existing) {
        await repository.claimIfAbsent(record);
        return "ACQUIRED";
    }
    if (existing.status === "SUCCEEDED") {
        return "ALREADY_SUCCEEDED";
    }
    if (existing.status === "IN_PROGRESS") {
        throw new provider_errors_1.CompensationTransientError("Compensation idempotency lock already in progress");
    }
    const transitioned = await repository.transitionStatus({
        scope: "compensation",
        key: record.key,
        fromStatus: existing.status,
        toStatus: "IN_PROGRESS",
        updatedAtIso: record.updatedAtIso,
        linkedExecutionId: record.linkedExecutionId
    });
    if (!transitioned) {
        throw new provider_errors_1.CompensationTransientError("Unable to reacquire compensation idempotency lock");
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
        const compensationEvent = (0, execution_context_1.propagateExecutionContext)(event, executionContext);
        const legEvent = {
            executionId: compensationEvent.executionId,
            legId: compensationEvent.legId,
            status: "SUCCEEDED",
            providerTransferId: compensationEvent.providerTransferId,
            reason: compensationEvent.reason
        };
        const compensationIdempotencyKey = (0, key_builders_1.buildCompensationIdempotencyKey)({
            executionId: compensationEvent.executionId,
            legEvent
        });
        if (!compensationEvent.providerTransferId) {
            logger.error("Compensation requires manual review due to missing transfer id", {
                classification: "COMPENSATION_REQUIRED",
                executionContext,
                legId: compensationEvent.legId,
                compensationIdempotencyKey,
                metricName: metrics_alarms_1.OBSERVABILITY_METRICS.compensationRequired.metricName,
                metricValue: 1
            });
            return {
                executionId: compensationEvent.executionId,
                legId: compensationEvent.legId,
                status: "MANUAL_REVIEW_REQUIRED",
                compensationIdempotencyKey,
                reason: "MISSING_PROVIDER_TRANSFER_ID",
                correlationId: executionContext.correlationId
            };
        }
        const requestHash = hashPayload({
            executionId: compensationEvent.executionId,
            legId: compensationEvent.legId,
            providerTransferId: compensationEvent.providerTransferId,
            reason: compensationEvent.reason
        });
        const lockState = await ensureCompensationIdempotencyLock(dependencies.repositories.idempotency, {
            scope: "compensation",
            key: compensationIdempotencyKey,
            status: "IN_PROGRESS",
            requestHash,
            linkedExecutionId: compensationEvent.executionId,
            createdAtIso: timestampIso,
            updatedAtIso: timestampIso
        });
        if (lockState === "ALREADY_SUCCEEDED") {
            logger.info("Compensation replay detected via idempotency lock", {
                executionContext,
                legId: compensationEvent.legId,
                compensationIdempotencyKey
            });
            return {
                executionId: compensationEvent.executionId,
                legId: compensationEvent.legId,
                status: "COMPENSATED",
                compensationIdempotencyKey,
                reason: "IDEMPOTENT_REPLAY",
                correlationId: executionContext.correlationId
            };
        }
        try {
            logger.info("Starting transfer leg compensation", {
                executionContext,
                legId: compensationEvent.legId,
                compensationIdempotencyKey
            });
            const providerResult = await dependencies.provider.reverseTransfer({
                executionId: compensationEvent.executionId,
                legId: compensationEvent.legId,
                providerTransferId: compensationEvent.providerTransferId,
                reason: compensationEvent.reason,
                idempotencyKey: compensationIdempotencyKey
            });
            await dependencies.repositories.executions.transitionTransferLegStatus({
                executionId: compensationEvent.executionId,
                legId: compensationEvent.legId,
                fromStatus: "SUCCEEDED",
                toStatus: "FAILED",
                updatedAtIso: timestampIso,
                reason: `COMPENSATED:${providerResult.providerCompensationId}`
            });
            await dependencies.repositories.idempotency.transitionStatus({
                scope: "compensation",
                key: compensationIdempotencyKey,
                fromStatus: "IN_PROGRESS",
                toStatus: "SUCCEEDED",
                updatedAtIso: timestampIso,
                responseHash: hashPayload(providerResult),
                linkedExecutionId: compensationEvent.executionId
            });
            await dependencies.repositories.audit.append({
                day: toDayKey(timestampIso),
                executionId: compensationEvent.executionId,
                step: "TRANSFER_COMPENSATED",
                timestampIso,
                detail: {
                    legId: compensationEvent.legId,
                    providerTransferId: compensationEvent.providerTransferId,
                    providerCompensationId: providerResult.providerCompensationId,
                    compensationIdempotencyKey
                }
            });
            logger.info("Transfer leg compensation succeeded", {
                executionContext,
                legId: compensationEvent.legId,
                providerCompensationId: providerResult.providerCompensationId,
                compensationIdempotencyKey
            });
            return {
                executionId: compensationEvent.executionId,
                legId: compensationEvent.legId,
                status: "COMPENSATED",
                compensationIdempotencyKey,
                providerCompensationId: providerResult.providerCompensationId,
                correlationId: executionContext.correlationId
            };
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : "COMPENSATION_PROVIDER_ERROR";
            await dependencies.repositories.idempotency.transitionStatus({
                scope: "compensation",
                key: compensationIdempotencyKey,
                fromStatus: "IN_PROGRESS",
                toStatus: "FAILED",
                updatedAtIso: timestampIso,
                responseHash: hashPayload({ reason }),
                linkedExecutionId: compensationEvent.executionId
            });
            if (error instanceof provider_errors_1.CompensationTransientError) {
                logger.error("Compensation idempotency conflict detected", {
                    classification: "IDEMPOTENCY_CONFLICT",
                    executionContext,
                    legId: compensationEvent.legId,
                    compensationIdempotencyKey,
                    error
                });
                throw error;
            }
            if (error instanceof provider_errors_1.ProviderTransientError) {
                logger.error("Compensation encountered retryable provider error", {
                    classification: "PROVIDER_TRANSIENT",
                    executionContext,
                    legId: compensationEvent.legId,
                    compensationIdempotencyKey,
                    error
                });
                throw new provider_errors_1.CompensationTransientError(error.message);
            }
            if (error instanceof provider_errors_1.ProviderError) {
                logger.error("Compensation requires manual review due to terminal provider error", {
                    classification: "COMPENSATION_REQUIRED",
                    executionContext,
                    legId: compensationEvent.legId,
                    compensationIdempotencyKey,
                    metricName: metrics_alarms_1.OBSERVABILITY_METRICS.compensationRequired.metricName,
                    metricValue: 1,
                    error
                });
                return {
                    executionId: compensationEvent.executionId,
                    legId: compensationEvent.legId,
                    status: "MANUAL_REVIEW_REQUIRED",
                    compensationIdempotencyKey,
                    reason: error.code,
                    correlationId: executionContext.correlationId
                };
            }
            logger.error("Compensation requires manual review due to unexpected error", {
                classification: "UNEXPECTED",
                executionContext,
                legId: compensationEvent.legId,
                compensationIdempotencyKey,
                metricName: metrics_alarms_1.OBSERVABILITY_METRICS.compensationRequired.metricName,
                metricValue: 1,
                error
            });
            return {
                executionId: compensationEvent.executionId,
                legId: compensationEvent.legId,
                status: "MANUAL_REVIEW_REQUIRED",
                compensationIdempotencyKey,
                reason,
                correlationId: executionContext.correlationId
            };
        }
    };
};
exports.createHandler = createHandler;
exports.handler = (0, exports.createHandler)();
