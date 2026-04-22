# Discussion context

## Topic
Understand current codebase connectivity before evaluating replacing Plaid with bank-to-bank options (FedNow, RTP).

## Findings
- Current architecture is a two-app monorepo: `apps/web` (Next.js UI) and `apps/api` (Flask API), with MongoDB persistence.
- Plaid is hardwired end-to-end in frontend (`PlaidLinkButton`, `plaidApi`) and backend routes/handler (`/api/plaid/*`, `plaid_handler.py`), with Plaid-specific env/config in `config.py`.
- The product currently focuses on account linking and transaction ingestion/sync; there is no transfer initiation rail abstraction yet.

## Decisions made
- Start with architecture discovery and dependency mapping before implementation planning.

---

## Topic
Assess difficulty of refactoring current codebase to target architecture:
- Next.js on Amplify + Plaid Link
- API Gateway + TypeScript Lambdas + Step Functions
- DynamoDB for split rules + audit trail
- Lithic webhook-triggered split transfers
- Bedrock-driven transfer suggestions
- Security hardening (idempotency, IAM least privilege, Secrets Manager)

## Findings
- Current backend is Flask/Python (`apps/api`) with synchronous request handlers and no serverless boundaries, so this is a platform migration plus domain expansion, not a light refactor.
- Current product scope is Plaid link + account/transaction fetch. It does not yet include money movement rails, webhook-driven execution, workflow orchestration, or compensating transactions.
- Persistence layer is Mongo-backed dict-like wrappers (`app/models/__init__.py`), which will require full data model redesign for DynamoDB access patterns and idempotency-led transaction records.
- Frontend already uses Next.js + Plaid Link, so presentation-layer migration is comparatively low risk; backend contracts and auth/session model are the larger change drivers.
- Reliability and integrity requirements (idempotency keys, retries, undo/notification flows) imply introducing a state machine boundary (Step Functions), which is a meaningful architectural shift from current direct handler logic.

## Decisions made
- Classify migration difficulty as **high** overall.
- Treat this as a staged transformation:
  1) Stabilize domain model + event contracts
  2) Introduce transfer orchestration (Step Functions)
  3) Migrate execution to Lambda/API Gateway
  4) Add Bedrock suggestion pipeline after core money movement is reliable

---

## Topic
Dive into DynamoDB schema + idempotency key strategy for webhook-driven split transfers.

## Findings
- The safest shape is a **single-table design** with explicit entity prefixes and immutable event lineage.
- Idempotency must exist at two layers:
  - inbound webhook dedupe (same webhook delivered multiple times)
  - outbound transfer dedupe (same transfer call retried by Lambda/Step Functions)
- The split execution requires durable tracking of each leg transfer (e.g., 20/80), not just a parent transfer, so partial failures can be retried/compensated deterministically.

## Decisions made
- Recommend one primary table `BankingCore` with these entity patterns:
  - `PK=USER#{userId}`, `SK=PROFILE` (user metadata)
  - `PK=USER#{userId}`, `SK=RULE#{ruleId}` (split rules + versioning metadata)
  - `PK=EVENT#{eventId}`, `SK=METADATA` (normalized inbound webhook payload, source, hash, receivedAt, status)
  - `PK=EXEC#{executionId}`, `SK=SUMMARY` (overall workflow state)
  - `PK=EXEC#{executionId}`, `SK=LEG#{legId}` (one row per destination transfer leg)
  - `PK=IDEMP#{scope}#{key}`, `SK=LOCK` (idempotency lock/result pointer)
  - `PK=AUDIT#{yyyymmdd}`, `SK={timestamp}#{executionId}#{step}` (append-only audit trail)
- Recommend GSIs:
  - `GSI1PK=USER#{userId}`, `GSI1SK=RULE#{isActive}#{priority}` for active-rule lookup
  - `GSI2PK=EVENT_SOURCE#{source}`, `GSI2SK={receivedAt}` for ops/debug replay windows
  - `GSI3PK=STATUS#{workflowStatus}`, `GSI3SK={updatedAt}` for failed/pending execution monitoring
- Idempotency key strategy:
  - **Inbound key**: `scope=webhook`, key = `sha256(source + external_event_id + account_id + amount + posted_at)`; write `IDEMP#webhook#{hash}` via conditional put (`attribute_not_exists(PK)`).
  - **Outbound key**: `scope=transfer`, key = `executionId + legId + destinationAccount + amount`; persist before calling Lithic; pass same key to Lithic idempotency header.
  - Store `status` (`IN_PROGRESS|SUCCEEDED|FAILED`), `responseDigest`, `expiresAt` (TTL) in idempotency item.
  - On retry: if idempotency item exists and `SUCCEEDED`, return stored result; if `IN_PROGRESS`, short-circuit and retry later; if `FAILED`, only retry under controlled policy.
- Consistency model:
  - Use conditional writes for first-write wins on idempotency and state transitions.
  - Keep transfer legs as source of truth; summary status is derived/updated transactionally where possible.
  - Avoid broad multi-item transactions for hot paths except critical state transitions.

---

## Topic
What Step Functions are and a concrete state machine for split-transfer leg retries + compensation.

## Findings
- AWS Step Functions is an orchestration service: it runs a durable workflow (state machine) across Lambdas/services with built-in retries, waits, branching, timeouts, and failure handling.
- For money movement, Step Functions is useful because it gives deterministic control over:
  - per-leg retry policy
  - partial-failure handling
  - compensation and alerting paths
  - end-to-end execution traceability
- The split flow should process transfer legs independently but converge on a final reconciliation state.

## Decisions made
- Recommended state machine shape:
  1) `ValidateWebhookAndAcquireInboundIdempotency`
  2) `LoadUserRules`
  3) `ComputeLegPlan` (amount allocation + rounding)
  4) `PersistExecutionAndLegs`
  5) `ProcessLegs` (Map state over legs with controlled concurrency)
     - `AcquireLegIdempotency`
     - `InitiateLithicTransfer` (Retry for transient errors)
     - `PollOrConfirmTransfer`
     - `MarkLegSucceeded` or `MarkLegFailed`
  6) `EvaluateAggregateOutcome`
     - all legs succeeded -> `MarkExecutionSucceeded`
     - one/more legs failed -> `CompensateSucceededLegs`
  7) `CompensateSucceededLegs` (Map state)
     - `AcquireCompensationIdempotency`
     - `InitiateReversalOrCounterTransfer` (Retry)
     - `MarkCompensationResult`
  8) `FinalizeFailedExecutionAndNotify`
- Retry strategy:
  - Use Step Functions `Retry` with exponential backoff + jitter for network/5xx/timeouts.
  - Do not retry business-hard failures (validation errors, insufficient funds, invalid account).
- Compensation strategy:
  - Prefer explicit reversal operation if Lithic supports it for the rail/type.
  - Otherwise issue counter-transfer to origin account as compensating action.
  - Compensation actions must have independent idempotency keys.
- Recommended terminal statuses:
  - `SUCCEEDED`
  - `FAILED_NO_SIDE_EFFECTS`
  - `FAILED_COMPENSATED`
  - `FAILED_COMPENSATION_REQUIRED_MANUAL`
