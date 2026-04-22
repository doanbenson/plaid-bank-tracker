export const OBSERVABILITY_NAMESPACE = "BankingBento/ServerlessBackend";

interface MetricDefinition {
  namespace: string;
  metricName: string;
  description: string;
  statistic: "Sum";
  unit: "Count";
  periodSeconds: number;
  dimensions: readonly string[];
}

interface AlarmDefinition {
  alarmName: string;
  description: string;
  metricName: string;
  namespace: string;
  statistic: "Sum";
  periodSeconds: number;
  threshold: number;
  evaluationPeriods: number;
  datapointsToAlarm: number;
  comparisonOperator: "GreaterThanOrEqualToThreshold";
  treatMissingData: "notBreaching";
}

export const OBSERVABILITY_METRICS = {
  failedExecutions: {
    namespace: OBSERVABILITY_NAMESPACE,
    metricName: "FailedExecutions",
    description:
      "Count of transfer execution attempts that end in a terminal failed outcome.",
    statistic: "Sum",
    unit: "Count",
    periodSeconds: 60,
    dimensions: ["service", "operation"]
  } satisfies MetricDefinition,
  compensationRequired: {
    namespace: OBSERVABILITY_NAMESPACE,
    metricName: "CompensationRequired",
    description:
      "Count of transfer legs routed to manual review or compensation handling.",
    statistic: "Sum",
    unit: "Count",
    periodSeconds: 60,
    dimensions: ["service", "operation"]
  } satisfies MetricDefinition,
  webhookValidationFailures: {
    namespace: OBSERVABILITY_NAMESPACE,
    metricName: "WebhookValidationFailures",
    description:
      "Count of webhook requests rejected due to malformed or invalid payloads.",
    statistic: "Sum",
    unit: "Count",
    periodSeconds: 60,
    dimensions: ["service", "operation", "provider"]
  } satisfies MetricDefinition
} as const;

export const OBSERVABILITY_ALARMS = {
  failedExecutionsHigh: {
    alarmName: "serverless-backend-failed-executions-high",
    description: "Triggers when transfer execution failures are observed.",
    metricName: OBSERVABILITY_METRICS.failedExecutions.metricName,
    namespace: OBSERVABILITY_NAMESPACE,
    statistic: "Sum",
    periodSeconds: 300,
    threshold: 1,
    evaluationPeriods: 1,
    datapointsToAlarm: 1,
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    treatMissingData: "notBreaching"
  } satisfies AlarmDefinition,
  compensationRequiredHigh: {
    alarmName: "serverless-backend-compensation-required-high",
    description:
      "Triggers when compensation or manual review actions are required.",
    metricName: OBSERVABILITY_METRICS.compensationRequired.metricName,
    namespace: OBSERVABILITY_NAMESPACE,
    statistic: "Sum",
    periodSeconds: 300,
    threshold: 1,
    evaluationPeriods: 1,
    datapointsToAlarm: 1,
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    treatMissingData: "notBreaching"
  } satisfies AlarmDefinition,
  webhookValidationFailuresHigh: {
    alarmName: "serverless-backend-webhook-validation-failures-high",
    description:
      "Triggers when webhook payload validation failures are observed.",
    metricName: OBSERVABILITY_METRICS.webhookValidationFailures.metricName,
    namespace: OBSERVABILITY_NAMESPACE,
    statistic: "Sum",
    periodSeconds: 300,
    threshold: 5,
    evaluationPeriods: 1,
    datapointsToAlarm: 1,
    comparisonOperator: "GreaterThanOrEqualToThreshold",
    treatMissingData: "notBreaching"
  } satisfies AlarmDefinition
} as const;
