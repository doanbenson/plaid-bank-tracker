# Serverless backend cutover runbook

This runbook is for switching production traffic from legacy Flask APIs to the serverless backend path.
Use with `ops/cutover-checklist.md`.

## 1) Pre-cutover validation gates

All gates must be green before any traffic shift:

1. **Build + static quality**
   - `npm run build --workspace=serverless-backend` succeeds.
   - Root web build remains healthy (`npm run build`).
2. **IaC + config readiness**
   - Required identifiers are filled (not placeholders) in cutover config derived from `ops/cutover-config.template.json`.
   - `scripts/validate-cutover-config.ps1 -ConfigPath <file>` succeeds.
   - `scripts/validate-cutover-rollback.ps1 -ConfigPath <file>` succeeds.
    - Step Functions state machine definition deployed and references live Lambda ARNs.
3. **Data and idempotency readiness**
   - DynamoDB table `BankingCore` and GSIs are provisioned.
   - CloudWatch alarms for:
     - `FailedExecutions`
     - `CompensationRequired`
     - `WebhookValidationFailures`
4. **Operational readiness**
   - On-call owner + rollback approver assigned.
   - Incident channel open and dashboard links shared.
5. **Dry run**
   - Execute synthetic ingress payload in non-prod environment and verify:
     - webhook accepted (202 path),
      - transfer-leg status transitions,
      - compensation path (forced failure scenario).

For local repo-only preflight automation:
- `npm run cutover:preflight --workspace=serverless-backend` (template-safe dry run).
- `powershell -ExecutionPolicy Bypass -File .\scripts\invoke-cutover-preflight.ps1 -ConfigPath <real-config-file> -EnforceChecklist` (release gate).

## 2) Traffic switch sequence

Recommended progressive switch:

1. **T-30m freeze**
   - Freeze schema and deploy changes unrelated to cutover.
2. **Enable shadow/synthetic checks**
   - Keep legacy path serving traffic.
   - Run synthetic events against serverless entrypoint.
3. **Canary shift**
   - Route 5% traffic to serverless API/Lambda integration.
   - Observe 15 minutes minimum.
4. **Progressive increase**
   - 25% -> 50% -> 100%, with hold window at each step.
   - Do not proceed if any rollback trigger fires.
5. **Legacy drain**
   - Stop new writes on legacy transfer execution path.
   - Keep legacy components read-only for rollback window.

## 3) Rollback triggers and steps

### Rollback triggers
- `FailedExecutions` alarm breaches threshold (>=1 in 5 min) repeatedly.
- `CompensationRequired` trend exceeds expected baseline.
- Duplicate transfer indications (idempotency mismatch) detected.
- P95/P99 latency or 5xx error rate exceeds agreed SLO for 10+ minutes.
- Reconciliation mismatch between event intake and execution outcomes.

### Rollback steps
1. Route traffic immediately back to legacy Flask path (100%).
2. Disable serverless cutover routing rule/canary policy.
3. Pause webhook ingestion to serverless path if duplicate processing risk exists.
4. Snapshot failure context:
   - execution IDs,
   - correlation IDs,
   - affected leg IDs,
   - provider transfer IDs.
5. Verify no in-flight compensations remain untracked.
6. Incident commander declares rollback complete and starts postmortem.

## 4) Post-cutover verification

Within first 60 minutes at 100% traffic:

1. **Functional checks**
   - Webhook ingress acceptance rate normal.
   - Transfer legs move `PENDING -> IN_PROGRESS -> SUCCEEDED|FAILED` as expected.
2. **Reliability checks**
   - No sustained alarm breaches in CloudWatch.
   - Retry volume remains within forecast.
3. **Financial controls**
   - Reconciliation sample confirms expected split amounts.
   - No unexpected compensations/manual interventions.
4. **Auditability**
   - Execution and audit entries queryable for sampled executions.
5. **Sign-off**
   - Operations, backend owner, and product owner approve closure.

## 5) Local scope and external blockers

This repository can prepare artifacts and validation tooling only.
Actual cutover requires deployed AWS infrastructure, production routing controls, live provider credentials, and on-call approvals outside local execution context.
