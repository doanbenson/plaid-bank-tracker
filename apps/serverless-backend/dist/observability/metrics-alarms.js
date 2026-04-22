"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBSERVABILITY_ALARMS = exports.OBSERVABILITY_METRICS = exports.OBSERVABILITY_NAMESPACE = void 0;
exports.OBSERVABILITY_NAMESPACE = "BankingBento/ServerlessBackend";
exports.OBSERVABILITY_METRICS = {
    failedExecutions: {
        namespace: exports.OBSERVABILITY_NAMESPACE,
        metricName: "FailedExecutions",
        description: "Count of transfer execution attempts that end in a terminal failed outcome.",
        statistic: "Sum",
        unit: "Count",
        periodSeconds: 60,
        dimensions: ["service", "operation"]
    },
    compensationRequired: {
        namespace: exports.OBSERVABILITY_NAMESPACE,
        metricName: "CompensationRequired",
        description: "Count of transfer legs routed to manual review or compensation handling.",
        statistic: "Sum",
        unit: "Count",
        periodSeconds: 60,
        dimensions: ["service", "operation"]
    },
    webhookValidationFailures: {
        namespace: exports.OBSERVABILITY_NAMESPACE,
        metricName: "WebhookValidationFailures",
        description: "Count of webhook requests rejected due to malformed or invalid payloads.",
        statistic: "Sum",
        unit: "Count",
        periodSeconds: 60,
        dimensions: ["service", "operation", "provider"]
    }
};
exports.OBSERVABILITY_ALARMS = {
    failedExecutionsHigh: {
        alarmName: "serverless-backend-failed-executions-high",
        description: "Triggers when transfer execution failures are observed.",
        metricName: exports.OBSERVABILITY_METRICS.failedExecutions.metricName,
        namespace: exports.OBSERVABILITY_NAMESPACE,
        statistic: "Sum",
        periodSeconds: 300,
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        treatMissingData: "notBreaching"
    },
    compensationRequiredHigh: {
        alarmName: "serverless-backend-compensation-required-high",
        description: "Triggers when compensation or manual review actions are required.",
        metricName: exports.OBSERVABILITY_METRICS.compensationRequired.metricName,
        namespace: exports.OBSERVABILITY_NAMESPACE,
        statistic: "Sum",
        periodSeconds: 300,
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        treatMissingData: "notBreaching"
    },
    webhookValidationFailuresHigh: {
        alarmName: "serverless-backend-webhook-validation-failures-high",
        description: "Triggers when webhook payload validation failures are observed.",
        metricName: exports.OBSERVABILITY_METRICS.webhookValidationFailures.metricName,
        namespace: exports.OBSERVABILITY_NAMESPACE,
        statistic: "Sum",
        periodSeconds: 300,
        threshold: 5,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        treatMissingData: "notBreaching"
    }
};
