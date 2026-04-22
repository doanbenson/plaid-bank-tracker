import { createHash } from "node:crypto";

import { TransferLegStatusEvent } from "../contracts/events";
import {
  CompensationTransientError,
  ProviderError,
  ProviderTransientError
} from "../errors/provider-errors";
import { buildCompensationIdempotencyKey } from "../idempotency/key-builders";
import {
  createExecutionContext,
  propagateExecutionContext
} from "../observability/execution-context";
import { OBSERVABILITY_METRICS } from "../observability/metrics-alarms";
import { createStructuredLogger } from "../observability/structured-logger";
import { createInMemoryBankingCoreRepositories } from "../repositories/in-memory-banking-core-repositories";
import { BankingCoreRepositories, IdempotencyRepository } from "../repositories/interfaces";
import { IdempotencyRecord } from "../repositories/types";
import {
  getDefaultLithicTransferProvider,
  LithicTransferProvider
} from "../providers/lithic-transfer-provider";

export interface CompensateTransferLegInput {
  executionId: string;
  correlationId?: string;
  legId: string;
  providerTransferId: string;
  reason: string;
}

export interface CompensateTransferLegResult {
  executionId: string;
  legId: string;
  status: "COMPENSATED" | "MANUAL_REVIEW_REQUIRED";
  compensationIdempotencyKey?: string;
  providerCompensationId?: string;
  reason?: string;
  correlationId: string;
}

interface CompensateTransferLegDependencies {
  repositories: Pick<BankingCoreRepositories, "executions" | "idempotency" | "audit">;
  provider: LithicTransferProvider;
  now: () => Date;
}

const inMemoryDefaultRepositories = createInMemoryBankingCoreRepositories();

const defaultDependencies: CompensateTransferLegDependencies = {
  repositories: {
    executions: inMemoryDefaultRepositories.executions,
    idempotency: inMemoryDefaultRepositories.idempotency,
    audit: inMemoryDefaultRepositories.audit
  },
  provider: getDefaultLithicTransferProvider(),
  now: () => new Date()
};

const logger = createStructuredLogger({
  service: "serverless-backend",
  component: "compensate-transfer-leg"
});

const hashPayload = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

const toDayKey = (iso: string): string => iso.slice(0, 10).replace(/-/g, "");

const ensureCompensationIdempotencyLock = async (
  repository: IdempotencyRepository,
  record: IdempotencyRecord
): Promise<"ACQUIRED" | "ALREADY_SUCCEEDED"> => {
  const existing = await repository.get("compensation", record.key);
  if (!existing) {
    await repository.claimIfAbsent(record);
    return "ACQUIRED";
  }

  if (existing.status === "SUCCEEDED") {
    return "ALREADY_SUCCEEDED";
  }

  if (existing.status === "IN_PROGRESS") {
    throw new CompensationTransientError("Compensation idempotency lock already in progress");
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
    throw new CompensationTransientError("Unable to reacquire compensation idempotency lock");
  }

  return "ACQUIRED";
};

export const createHandler = (
  dependencies: CompensateTransferLegDependencies = defaultDependencies
) => {
  return async (event: CompensateTransferLegInput): Promise<CompensateTransferLegResult> => {
    const timestampIso = dependencies.now().toISOString();
    const executionContext = createExecutionContext({
      executionId: event.executionId,
      correlationId: event.correlationId
    });
    const compensationEvent = propagateExecutionContext(event, executionContext);

    const legEvent: TransferLegStatusEvent = {
      executionId: compensationEvent.executionId,
      legId: compensationEvent.legId,
      status: "SUCCEEDED",
      providerTransferId: compensationEvent.providerTransferId,
      reason: compensationEvent.reason
    };
    const compensationIdempotencyKey = buildCompensationIdempotencyKey({
      executionId: compensationEvent.executionId,
      legEvent
    });

    if (!compensationEvent.providerTransferId) {
      logger.error("Compensation requires manual review due to missing transfer id", {
        classification: "COMPENSATION_REQUIRED",
        executionContext,
        legId: compensationEvent.legId,
        compensationIdempotencyKey,
        metricName: OBSERVABILITY_METRICS.compensationRequired.metricName,
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

    const lockState = await ensureCompensationIdempotencyLock(
      dependencies.repositories.idempotency,
      {
        scope: "compensation",
        key: compensationIdempotencyKey,
        status: "IN_PROGRESS",
        requestHash,
        linkedExecutionId: compensationEvent.executionId,
        createdAtIso: timestampIso,
        updatedAtIso: timestampIso
      }
    );

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
    } catch (error) {
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

      if (error instanceof CompensationTransientError) {
        logger.error("Compensation idempotency conflict detected", {
          classification: "IDEMPOTENCY_CONFLICT",
          executionContext,
          legId: compensationEvent.legId,
          compensationIdempotencyKey,
          error
        });
        throw error;
      }

      if (error instanceof ProviderTransientError) {
        logger.error("Compensation encountered retryable provider error", {
          classification: "PROVIDER_TRANSIENT",
          executionContext,
          legId: compensationEvent.legId,
          compensationIdempotencyKey,
          error
        });
        throw new CompensationTransientError(error.message);
      }

      if (error instanceof ProviderError) {
        logger.error("Compensation requires manual review due to terminal provider error", {
          classification: "COMPENSATION_REQUIRED",
          executionContext,
          legId: compensationEvent.legId,
          compensationIdempotencyKey,
          metricName: OBSERVABILITY_METRICS.compensationRequired.metricName,
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
        metricName: OBSERVABILITY_METRICS.compensationRequired.metricName,
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

export const handler = createHandler();
