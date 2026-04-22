import { randomUUID } from "node:crypto";

export interface ExecutionContext {
  executionId?: string;
  correlationId: string;
}

interface CreateExecutionContextInput {
  executionId?: string;
  correlationId?: string;
  fallbackCorrelationId?: string;
}

type ContextCarrier = {
  executionId?: string;
  correlationId?: string;
};

const normalizeIdentifier = (value?: string): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const extractCorrelationIdFromHeaders = (
  headers?: Record<string, string | undefined>
): string | undefined => {
  if (!headers) {
    return undefined;
  }

  const matches = Object.entries(headers).find(([headerName]) =>
    ["x-correlation-id", "x-request-id", "x-amzn-trace-id"].includes(
      headerName.toLowerCase()
    )
  );

  return normalizeIdentifier(matches?.[1]);
};

export const createExecutionContext = (
  input: CreateExecutionContextInput
): ExecutionContext => {
  const executionId = normalizeIdentifier(input.executionId);
  const correlationId =
    normalizeIdentifier(input.correlationId) ??
    executionId ??
    normalizeIdentifier(input.fallbackCorrelationId) ??
    randomUUID();

  return {
    executionId,
    correlationId
  };
};

export const propagateExecutionContext = <T extends ContextCarrier>(
  payload: T,
  context: ExecutionContext
): T & { correlationId: string } => ({
  ...payload,
  executionId: payload.executionId ?? context.executionId,
  correlationId: payload.correlationId ?? context.correlationId
});
