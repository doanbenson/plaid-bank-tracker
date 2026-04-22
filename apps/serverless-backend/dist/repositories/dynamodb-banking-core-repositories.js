"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listExecutionAuditTimelineQuery = exports.createDynamoBankingCoreRepositories = void 0;
const schema_1 = require("../dynamodb/schema");
const keys_1 = require("../dynamodb/keys");
const idempotency_transitions_1 = require("./idempotency-transitions");
const buildConditionalPut = (item) => ({
    TableName: keys_1.BANKING_CORE_TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
});
const statusTransitionExpression = (key, fromStatus, toStatus, updatedAtIso, extras = {}) => {
    const expressionNames = {
        "#status": "status",
        "#updatedAtIso": "updatedAtIso"
    };
    const assignmentKeys = ["#status = :toStatus", "#updatedAtIso = :updatedAtIso"];
    const expressionValues = {
        ":fromStatus": fromStatus,
        ":toStatus": toStatus,
        ":updatedAtIso": updatedAtIso
    };
    for (const [keyName, keyValue] of Object.entries(extras)) {
        if (typeof keyValue === "undefined") {
            continue;
        }
        const nameToken = `#${keyName}`;
        const valueToken = `:${keyName}`;
        expressionNames[nameToken] = keyName;
        expressionValues[valueToken] = keyValue;
        assignmentKeys.push(`${nameToken} = ${valueToken}`);
    }
    return {
        TableName: keys_1.BANKING_CORE_TABLE,
        Key: key,
        ConditionExpression: "#status = :fromStatus",
        UpdateExpression: `SET ${assignmentKeys.join(", ")}`,
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: "ALL_NEW"
    };
};
const toUserProfileItem = (profile) => ({
    PK: keys_1.pk.user(profile.userId),
    SK: keys_1.sk.profile(),
    entityType: "USER_PROFILE",
    userId: profile.userId,
    status: profile.status,
    createdAtIso: profile.createdAtIso,
    updatedAtIso: profile.updatedAtIso,
    GSI1PK: keys_1.pk.user(profile.userId),
    GSI1SK: "PROFILE"
});
const toSplitRuleItem = (rule) => ({
    PK: keys_1.pk.user(rule.userId),
    SK: keys_1.sk.rule(rule.ruleId),
    entityType: "SPLIT_RULE",
    userId: rule.userId,
    ruleId: rule.ruleId,
    destinationAccountId: rule.destinationAccountId,
    percentage: rule.percentage,
    priority: rule.priority,
    isActive: rule.isActive,
    createdAtIso: rule.createdAtIso,
    updatedAtIso: rule.updatedAtIso,
    GSI1PK: keys_1.pk.user(rule.userId),
    GSI1SK: `RULE#${rule.priority.toString().padStart(6, "0")}#${rule.ruleId}`
});
const toEventItem = (event) => ({
    PK: keys_1.pk.event(event.eventId),
    SK: keys_1.sk.eventMetadata(),
    entityType: "EVENT",
    eventId: event.eventId,
    userId: event.userId,
    source: event.source,
    sourceAccountId: event.sourceAccountId,
    amountMinor: event.amountMinor,
    currency: event.currency,
    postedAtIso: event.postedAtIso,
    executionId: event.executionId,
    createdAtIso: event.createdAtIso,
    GSI1PK: keys_1.pk.user(event.userId),
    GSI1SK: `EVENT#${event.postedAtIso}#${event.eventId}`
});
const toExecutionItem = (execution) => ({
    PK: keys_1.pk.execution(execution.executionId),
    SK: keys_1.sk.summary(),
    entityType: "EXECUTION",
    executionId: execution.executionId,
    userId: execution.userId,
    sourceEventId: execution.sourceEventId,
    sourceAccountId: execution.sourceAccountId,
    sourceAmountMinor: execution.sourceAmountMinor,
    currency: execution.currency,
    status: execution.status,
    createdAtIso: execution.createdAtIso,
    updatedAtIso: execution.updatedAtIso,
    GSI1PK: keys_1.pk.user(execution.userId),
    GSI1SK: `EXEC#${execution.createdAtIso}#${execution.executionId}`
});
const toTransferLegItem = (leg) => ({
    PK: keys_1.pk.execution(leg.executionId),
    SK: keys_1.sk.leg(leg.legId),
    entityType: "TRANSFER_LEG",
    executionId: leg.executionId,
    legId: leg.legId,
    destinationAccountId: leg.destinationAccountId,
    amountMinor: leg.amountMinor,
    currency: leg.currency,
    idempotencyKey: leg.idempotencyKey,
    status: leg.status,
    providerTransferId: leg.providerTransferId,
    reason: leg.reason,
    createdAtIso: leg.createdAtIso,
    updatedAtIso: leg.updatedAtIso,
    GSI1PK: keys_1.pk.execution(leg.executionId),
    GSI1SK: keys_1.sk.leg(leg.legId)
});
const toIdempotencyItem = (record) => ({
    PK: keys_1.pk.idempotency(record.scope, record.key),
    SK: keys_1.sk.lock(),
    entityType: "IDEMPOTENCY",
    scope: record.scope,
    key: record.key,
    status: record.status,
    requestHash: record.requestHash,
    responseHash: record.responseHash,
    linkedExecutionId: record.linkedExecutionId,
    lockExpiresAtIso: record.lockExpiresAtIso,
    createdAtIso: record.createdAtIso,
    updatedAtIso: record.updatedAtIso,
    GSI1PK: `IDEMP#${record.scope}`,
    GSI1SK: `${record.createdAtIso}#${record.key}`,
    GSI2PK: `IDEMP#STATUS#${record.status}`,
    GSI2SK: `${record.updatedAtIso}#${record.scope}#${record.key}`
});
const toAuditItem = (record) => ({
    PK: keys_1.pk.audit(record.day),
    SK: keys_1.sk.auditEntry(record.timestampIso, record.executionId, record.step),
    entityType: "AUDIT",
    day: record.day,
    executionId: record.executionId,
    step: record.step,
    timestampIso: record.timestampIso,
    detail: record.detail,
    GSI1PK: keys_1.pk.execution(record.executionId),
    GSI1SK: `AUDIT#${record.timestampIso}#${record.step}`
});
const fromSplitRuleItem = (item) => ({
    userId: item.userId,
    ruleId: item.ruleId,
    destinationAccountId: item.destinationAccountId,
    percentage: item.percentage,
    priority: item.priority,
    isActive: item.isActive,
    createdAtIso: item.createdAtIso,
    updatedAtIso: item.updatedAtIso
});
const fromEventItem = (item) => ({
    eventId: item.eventId,
    userId: item.userId,
    source: item.source,
    sourceAccountId: item.sourceAccountId,
    amountMinor: item.amountMinor,
    currency: item.currency,
    postedAtIso: item.postedAtIso,
    executionId: item.executionId,
    createdAtIso: item.createdAtIso
});
const fromIdempotencyItem = (item) => ({
    scope: item.scope,
    key: item.key,
    status: item.status,
    requestHash: item.requestHash,
    responseHash: item.responseHash,
    linkedExecutionId: item.linkedExecutionId,
    lockExpiresAtIso: item.lockExpiresAtIso,
    createdAtIso: item.createdAtIso,
    updatedAtIso: item.updatedAtIso
});
class DynamoUserRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    async putProfileIfAbsent(profile) {
        await this.client.put(buildConditionalPut(toUserProfileItem(profile)));
    }
    async upsertSplitRule(rule) {
        await this.client.put({
            TableName: keys_1.BANKING_CORE_TABLE,
            Item: toSplitRuleItem(rule)
        });
    }
    async listSplitRules(userId) {
        const input = {
            TableName: keys_1.BANKING_CORE_TABLE,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :rulePrefix)",
            ExpressionAttributeValues: {
                ":pk": keys_1.pk.user(userId),
                ":rulePrefix": "RULE#"
            }
        };
        const result = await this.client.query(input);
        return (result.Items ?? []).map(fromSplitRuleItem);
    }
}
class DynamoEventRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    async putEventIfAbsent(event) {
        await this.client.put(buildConditionalPut(toEventItem(event)));
    }
    async getEvent(eventId) {
        const result = await this.client.get({
            TableName: keys_1.BANKING_CORE_TABLE,
            Key: {
                PK: keys_1.pk.event(eventId),
                SK: keys_1.sk.eventMetadata()
            }
        });
        if (!result.Item) {
            return null;
        }
        return fromEventItem(result.Item);
    }
}
class DynamoExecutionRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    async putExecutionIfAbsent(execution) {
        await this.client.put(buildConditionalPut(toExecutionItem(execution)));
    }
    async transitionExecutionStatus(input) {
        const update = statusTransitionExpression({ PK: keys_1.pk.execution(input.executionId), SK: keys_1.sk.summary() }, input.fromStatus, input.toStatus, input.updatedAtIso, { reason: input.reason });
        return this.tryConditionalUpdate(update);
    }
    async putTransferLegIfAbsent(leg) {
        await this.client.put(buildConditionalPut(toTransferLegItem(leg)));
    }
    async transitionTransferLegStatus(input) {
        const update = statusTransitionExpression({ PK: keys_1.pk.execution(input.executionId), SK: keys_1.sk.leg(input.legId) }, input.fromStatus, input.toStatus, input.updatedAtIso, {
            providerTransferId: input.providerTransferId,
            reason: input.reason
        });
        return this.tryConditionalUpdate(update);
    }
    async tryConditionalUpdate(input) {
        try {
            await this.client.update(input);
            return true;
        }
        catch {
            return false;
        }
    }
}
class DynamoIdempotencyRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    async claimIfAbsent(record) {
        await this.client.put(buildConditionalPut(toIdempotencyItem(record)));
    }
    async get(scope, key) {
        const result = await this.client.get({
            TableName: keys_1.BANKING_CORE_TABLE,
            Key: {
                PK: keys_1.pk.idempotency(scope, key),
                SK: keys_1.sk.lock()
            }
        });
        if (!result.Item) {
            return null;
        }
        return fromIdempotencyItem(result.Item);
    }
    async transitionStatus(input) {
        if (!(0, idempotency_transitions_1.isIdempotencyTransitionAllowed)(input.fromStatus, input.toStatus)) {
            return false;
        }
        const update = statusTransitionExpression({ PK: keys_1.pk.idempotency(input.scope, input.key), SK: keys_1.sk.lock() }, input.fromStatus, input.toStatus, input.updatedAtIso, {
            responseHash: input.responseHash,
            linkedExecutionId: input.linkedExecutionId,
            GSI2PK: `IDEMP#STATUS#${input.toStatus}`,
            GSI2SK: `${input.updatedAtIso}#${input.scope}#${input.key}`
        });
        try {
            await this.client.update(update);
            return true;
        }
        catch {
            return false;
        }
    }
}
class DynamoAuditRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    async append(record) {
        await this.client.put({
            TableName: keys_1.BANKING_CORE_TABLE,
            Item: toAuditItem(record)
        });
    }
}
const createDynamoBankingCoreRepositories = (client) => ({
    users: new DynamoUserRepository(client),
    events: new DynamoEventRepository(client),
    executions: new DynamoExecutionRepository(client),
    idempotency: new DynamoIdempotencyRepository(client),
    audit: new DynamoAuditRepository(client)
});
exports.createDynamoBankingCoreRepositories = createDynamoBankingCoreRepositories;
const listExecutionAuditTimelineQuery = (executionId) => ({
    TableName: keys_1.BANKING_CORE_TABLE,
    IndexName: schema_1.BANKING_CORE_GSI1,
    KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :auditPrefix)",
    ExpressionAttributeValues: {
        ":gsi1pk": keys_1.pk.execution(executionId),
        ":auditPrefix": "AUDIT#"
    }
});
exports.listExecutionAuditTimelineQuery = listExecutionAuditTimelineQuery;
