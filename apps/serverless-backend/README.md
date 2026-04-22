# Serverless Backend Scaffold

This workspace contains the initial migration scaffold for replacing Flask with AWS serverless components.

## Included
- Domain contracts for executions and transfer-leg statuses.
- DynamoDB key helpers for a single-table `BankingCore` model.
- DynamoDB table/GSI schema artifact (`src/dynamodb/schema.ts`).
- Idempotency key builders for inbound webhook, transfer leg, and compensation paths.
- Typed repository interfaces and DynamoDB repository primitives (`src/repositories/*`).
- Lambda handlers for Lithic/Plaid webhook ingress, transfer execution, and compensation.
- Step Functions ASL definition for split transfer orchestration with retries and compensation.

## BankingCore schema and access patterns
- Table: `BankingCore`
- Keys:
  - `PK` (partition key), `SK` (sort key)
  - `GSI1PK`/`GSI1SK` via `GSI1`
  - `GSI2PK`/`GSI2SK` via `GSI2`

Entity key patterns:
- `USER#{userId}` + `PROFILE` / `RULE#{ruleId}`
- `EVENT#{eventId}` + `METADATA`
- `EXEC#{executionId}` + `SUMMARY` / `LEG#{legId}`
- `IDEMP#{scope}#{key}` + `LOCK`
- `AUDIT#{yyyymmdd}` + `{timestampIso}#{executionId}#{step}`

Access patterns:
- List user split rules: `PK = USER#{userId}` and `begins_with(SK, RULE#)`.
- Point-read event metadata: `PK = EVENT#{eventId}`, `SK = METADATA`.
- Point-read idempotency lock: `PK = IDEMP#{scope}#{key}`, `SK = LOCK`.
- Execution audit timeline: `GSI1PK = EXEC#{executionId}` and `begins_with(GSI1SK, AUDIT#)`.
- Idempotency lifecycle scans: `GSI2PK = IDEMP#STATUS#{status}`.

## Conditional write transitions
- Create-if-absent records use conditional put (`attribute_not_exists(PK) AND attribute_not_exists(SK)`).
- Status transitions use compare-and-set (`ConditionExpression: #status = :fromStatus`).
- Idempotency transition allow-list:
  - `RECEIVED -> IN_PROGRESS | FAILED`
  - `IN_PROGRESS -> SUCCEEDED | FAILED`
  - `FAILED -> IN_PROGRESS`
  - `SUCCEEDED` terminal

## Notes
- The state machine references Lambda ARNs as template variables (for IaC substitution).

## Ingress contract
- `src/lambdas/lithic-webhook-ingress.ts`
  - Expects JSON payload:
    - `event_id`, `user_id`, `account_id`, `amount_minor`, `currency`, `posted_at`
- `src/lambdas/plaid-webhook-ingress.ts`
  - Expects JSON payload:
    - `webhook_id`, `user_id`, `account_id`, `amount_minor`, `currency`, `posted_at`
- Runtime validation checks:
  - required non-empty strings
  - `amount_minor` positive integer
  - `currency` 3-letter ISO-style uppercase
  - `posted_at` parseable ISO timestamp
- On success, both handlers normalize to `DepositReceivedEvent` and compute inbound webhook idempotency keys.

## Inbound idempotency behavior
- Lock key shape aligns with the DynamoDB scaffold:
  - `PK=IDEMP#webhook#{hash}`, `SK=LOCK`
- Current default lock repository is in-memory (`InMemoryInboundIdempotencyLockRepository`) for scaffold execution.
- A DynamoDB-ready abstraction is included (`DynamoDbConditionalPutInboundIdempotencyLockRepository`) with a `putIfAbsent` contract so infrastructure can later perform conditional put (`attribute_not_exists(PK)` style first-write wins).
- HTTP responses:
  - `400` => invalid payload/JSON (`accepted: false`, `status: "invalid"`)
  - `200` => duplicate inbound event (`accepted: false`, `status: "duplicate"`)
  - `202` => accepted and lock acquired (`accepted: true`, `status: "accepted"`)

## Transfer leg execution behavior
- `src/lambdas/process-transfer-leg.ts` acquires outbound transfer idempotency (`scope=transfer`) before any provider call.
- Idempotency lock key comes from leg-plan `idempotencyKey` (or deterministic fallback builder).
- The handler moves records through repository-backed state transitions:
  - execution `PENDING -> IN_PROGRESS` (best-effort)
  - leg `PENDING -> IN_PROGRESS -> SUCCEEDED|FAILED`
  - idempotency `IN_PROGRESS -> SUCCEEDED|FAILED` (or `FAILED -> IN_PROGRESS` on retry reacquisition)
- Provider calls go through `src/providers/lithic-transfer-provider.ts` and always carry a Lithic-style `Idempotency-Key` header value.

## Compensation behavior
- `src/lambdas/compensate-transfer-leg.ts` acquires compensation idempotency (`scope=compensation`) using a deterministic key built from execution + leg + provider transfer id.
- Compensation performs provider reversal via the same Lithic abstraction and persists outcomes in repositories:
  - compensation idempotency `IN_PROGRESS -> SUCCEEDED|FAILED`
  - leg status `SUCCEEDED -> FAILED` with compensation reason metadata
  - audit append with provider transfer/reversal identifiers

## Provider error taxonomy and retries
- `src/errors/provider-errors.ts` defines typed provider failures:
  - `ProviderTransientError` (`TRANSIENT`) => retryable
  - `ProviderTerminalError` (`TERMINAL`) => non-retryable/manual resolution path
- Lambda retry signaling errors:
  - `TransferTransientError`
  - `CompensationTransientError`
- Step Functions retry policy (`state-machines/split-transfer.asl.json`) now includes these transient error names so only retry-safe failures are retried automatically.

## Observability model
- Shared execution context helper (`src/observability/execution-context.ts`):
  - extracts correlation IDs from ingress headers (`x-correlation-id`, `x-request-id`, `x-amzn-trace-id`)
  - normalizes or generates correlation IDs when absent
  - propagates `executionId`/`correlationId` through transfer + compensation inputs
- Structured logging utility (`src/observability/structured-logger.ts`) is used by ingress, transfer execution, and compensation lambdas.
  - All logs are JSON and include: `timestamp`, `level`, `service`, `component`, `message`.
  - Error logs include `classification`, `executionContext` (`executionId`, `correlationId`), and serialized `error` payload.
  - Metric hints (`metricName`, `metricValue`) are included on relevant failures for downstream log-metric filters.

### Metrics definitions (IaC artifact)
- `src/observability/metrics-alarms.ts` exports `OBSERVABILITY_METRICS` and `OBSERVABILITY_ALARMS` for CloudWatch IaC wiring.
- Metrics:
  - `FailedExecutions`
  - `CompensationRequired`
  - `WebhookValidationFailures`
- Alarm definitions:
  - `serverless-backend-failed-executions-high`
  - `serverless-backend-compensation-required-high`
  - `serverless-backend-webhook-validation-failures-high`

## Cutover operations artifacts
- Runbook: `ops/cutover-runbook.md`
- Execution checklist: `ops/cutover-checklist.md`
- Config placeholders: `ops/cutover-config.template.json`
- Local config validator stub: `scripts/validate-cutover-config.ps1`
