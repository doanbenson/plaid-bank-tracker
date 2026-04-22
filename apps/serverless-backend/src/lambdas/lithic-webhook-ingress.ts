import { DepositReceivedEvent } from "../contracts/events";
import { buildInboundWebhookIdempotencyKey } from "../idempotency/key-builders";
import {
  InboundIdempotencyLockRepository,
  getDefaultInboundIdempotencyLockRepository
} from "../idempotency/inbound-lock-repository";
import {
  createExecutionContext,
  extractCorrelationIdFromHeaders
} from "../observability/execution-context";
import { OBSERVABILITY_METRICS } from "../observability/metrics-alarms";
import { createStructuredLogger } from "../observability/structured-logger";

interface ApiGatewayRequest {
  body: string | null;
  headers?: Record<string, string | undefined>;
}

interface ApiGatewayResponse {
  statusCode: number;
  body: string;
}

const parseBody = (body: string | null): unknown => {
  if (!body) {
    return {};
  }
  return JSON.parse(body) as unknown;
};

const tryParseBody = (
  body: string | null
): { ok: true; value: unknown } | { ok: false; error: string } => {
  try {
    return { ok: true, value: parseBody(body) };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
};

interface LithicDepositPayload {
  event_id: string;
  user_id: string;
  account_id: string;
  amount_minor: number;
  currency: string;
  posted_at: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isValidIsoTimestamp = (value: string): boolean =>
  !Number.isNaN(Date.parse(value));

const isValidCurrency = (value: string): boolean => /^[A-Z]{3}$/.test(value);

const isLithicDepositPayload = (value: unknown): value is LithicDepositPayload => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    isNonEmptyString(payload.event_id) &&
    isNonEmptyString(payload.user_id) &&
    isNonEmptyString(payload.account_id) &&
    isPositiveInteger(payload.amount_minor) &&
    isNonEmptyString(payload.currency) &&
    isNonEmptyString(payload.posted_at) &&
    isValidCurrency(payload.currency.toUpperCase()) &&
    isValidIsoTimestamp(payload.posted_at)
  );
};

const toDepositReceivedEvent = (payload: LithicDepositPayload): DepositReceivedEvent => ({
  source: "lithic",
  externalEventId: payload.event_id.trim(),
  userId: payload.user_id.trim(),
  accountId: payload.account_id.trim(),
  amountMinor: payload.amount_minor,
  currency: payload.currency.toUpperCase(),
  postedAtIso: payload.posted_at
});

const badRequest = (error: string): ApiGatewayResponse => ({
  statusCode: 400,
  body: JSON.stringify({
    accepted: false,
    status: "invalid",
    error
  })
});

const logger = createStructuredLogger({
  service: "serverless-backend",
  component: "lithic-webhook-ingress"
});

export const createHandler = (
  lockRepository: InboundIdempotencyLockRepository = getDefaultInboundIdempotencyLockRepository()
) => {
  return async (event: ApiGatewayRequest): Promise<ApiGatewayResponse> => {
    const executionContext = createExecutionContext({
      correlationId: extractCorrelationIdFromHeaders(event.headers)
    });

    const parsed = tryParseBody(event.body);
    if (!parsed.ok) {
      logger.warn("Rejected webhook request due to invalid JSON", {
        classification: "WEBHOOK_VALIDATION_FAILED",
        executionContext,
        metricName: OBSERVABILITY_METRICS.webhookValidationFailures.metricName,
        metricValue: 1
      });
      return badRequest(parsed.error);
    }

    if (!isLithicDepositPayload(parsed.value)) {
      logger.warn("Rejected webhook request due to payload validation failure", {
        classification: "WEBHOOK_VALIDATION_FAILED",
        executionContext,
        metricName: OBSERVABILITY_METRICS.webhookValidationFailures.metricName,
        metricValue: 1
      });
      return badRequest("Invalid lithic webhook payload");
    }

    const domainEvent = toDepositReceivedEvent(parsed.value);
    const inboundIdempotencyKey = buildInboundWebhookIdempotencyKey(domainEvent);

    try {
      const lockResult = await lockRepository.acquireInboundLock({
        source: domainEvent.source,
        idempotencyKey: inboundIdempotencyKey,
        externalEventId: domainEvent.externalEventId,
        receivedAtIso: new Date().toISOString()
      });

      if (lockResult.status === "DUPLICATE") {
        logger.info("Webhook request identified as duplicate", {
          executionContext,
          source: domainEvent.source,
          externalEventId: domainEvent.externalEventId,
          inboundIdempotencyKey
        });

        return {
          statusCode: 200,
          body: JSON.stringify({
            accepted: false,
            status: "duplicate",
            inboundIdempotencyKey,
            correlationId: executionContext.correlationId,
            normalizedEvent: domainEvent
          })
        };
      }

      logger.info("Webhook request accepted", {
        executionContext,
        source: domainEvent.source,
        externalEventId: domainEvent.externalEventId,
        inboundIdempotencyKey
      });

      return {
        statusCode: 202,
        body: JSON.stringify({
          accepted: true,
          status: "accepted",
          inboundIdempotencyKey,
          correlationId: executionContext.correlationId,
          normalizedEvent: domainEvent
        })
      };
    } catch (error) {
      logger.error("Failed to process webhook idempotency lock", {
        classification: "UNEXPECTED",
        executionContext,
        source: domainEvent.source,
        externalEventId: domainEvent.externalEventId,
        inboundIdempotencyKey,
        error
      });

      throw error;
    }
  };
};

export const handler = createHandler();
