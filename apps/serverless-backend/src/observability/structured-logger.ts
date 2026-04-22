import { ExecutionContext } from "./execution-context";

export type ErrorClassification =
  | "WEBHOOK_VALIDATION_FAILED"
  | "EXECUTION_FAILED"
  | "COMPENSATION_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "PROVIDER_TRANSIENT"
  | "PROVIDER_TERMINAL"
  | "UNEXPECTED";

type LogLevel = "INFO" | "WARN" | "ERROR";

interface StructuredLogMetadata {
  classification?: ErrorClassification;
  executionContext?: ExecutionContext;
  metricName?: string;
  metricValue?: number;
  error?: unknown;
  [key: string]: unknown;
}

interface LoggerContext {
  service: string;
  component: string;
}

const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
};

const emit = (
  baseContext: LoggerContext,
  level: LogLevel,
  message: string,
  metadata: StructuredLogMetadata = {}
): void => {
  const { error, ...rest } = metadata;
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: baseContext.service,
    component: baseContext.component,
    message,
    ...rest
  };

  if (error !== undefined) {
    entry.error = serializeError(error);
  }

  const serialized = JSON.stringify(entry);
  if (level === "ERROR") {
    console.error(serialized);
    return;
  }

  if (level === "WARN") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
};

export const createStructuredLogger = (context: LoggerContext) => ({
  info: (message: string, metadata?: StructuredLogMetadata): void =>
    emit(context, "INFO", message, metadata),
  warn: (message: string, metadata?: StructuredLogMetadata): void =>
    emit(context, "WARN", message, metadata),
  error: (message: string, metadata?: StructuredLogMetadata): void =>
    emit(context, "ERROR", message, metadata)
});
