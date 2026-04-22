# Cutover execution checklist

Mark each item during execution.

## Pre-cutover
- [ ] `npm run build --workspace=serverless-backend` passed.
- [ ] `npm run build` (web) passed.
- [ ] Cutover config created from `ops/cutover-config.template.json`.
- [ ] `scripts/validate-cutover-config.ps1 -ConfigPath <file>` passed with no placeholder values.
- [ ] `scripts/validate-cutover-rollback.ps1 -ConfigPath <file>` passed.
- [ ] `scripts/get-cutover-checklist-status.ps1 -ChecklistPath <checklist-file>` reviewed and attached to incident thread.
- [ ] CloudWatch dashboards/alarms linked in incident channel.
- [ ] On-call engineer and rollback approver assigned.
- [ ] Synthetic event test completed and documented.

## Traffic switch
- [ ] Freeze window started.
- [ ] 5% canary enabled.
- [ ] Canary hold period complete and metrics healthy.
- [ ] 25% rollout healthy.
- [ ] 50% rollout healthy.
- [ ] 100% rollout healthy.
- [ ] Legacy path set to read-only/drain mode.

## Rollback readiness
- [ ] Rollback command/procedure tested in staging.
- [ ] Thresholds for automatic/manual rollback confirmed.
- [ ] Execution/correlation ID lookup process available.

## Post-cutover (first 60 minutes)
- [ ] Error rate and latency within SLO.
- [ ] No unexplained `FailedExecutions` spikes.
- [ ] Compensation/manual interventions within expected range.
- [ ] Reconciliation sample approved.
- [ ] Final sign-off recorded.
