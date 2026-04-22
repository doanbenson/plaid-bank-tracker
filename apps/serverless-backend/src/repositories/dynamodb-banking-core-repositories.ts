import { BANKING_CORE_GSI1 } from "../dynamodb/schema";
import { BANKING_CORE_TABLE, pk, sk } from "../dynamodb/keys";
import {
  DynamoRepositoryClient,
  PutItemInput,
  QueryItemsInput,
  UpdateItemInput
} from "./client";
import {
  AuditRepository,
  BankingCoreRepositories,
  EventRepository,
  ExecutionRepository,
  IdempotencyRepository,
  UserRepository
} from "./interfaces";
import { isIdempotencyTransitionAllowed } from "./idempotency-transitions";
import {
  AuditRecord,
  EventMetadataRecord,
  ExecutionSummaryRecord,
  IdempotencyRecord,
  IdempotencyScope,
  IdempotencyStatus,
  SplitRuleRecord,
  TransferLegRecord,
  UserProfileRecord
} from "./types";

type DynamoItem = Record<string, unknown>;

const buildConditionalPut = (item: DynamoItem): PutItemInput => ({
  TableName: BANKING_CORE_TABLE,
  Item: item,
  ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
});

const statusTransitionExpression = (
  key: { PK: string; SK: string },
  fromStatus: string,
  toStatus: string,
  updatedAtIso: string,
  extras: Record<string, unknown> = {}
): UpdateItemInput => {
  const expressionNames: Record<string, string> = {
    "#status": "status",
    "#updatedAtIso": "updatedAtIso"
  };

  const assignmentKeys = ["#status = :toStatus", "#updatedAtIso = :updatedAtIso"];
  const expressionValues: Record<string, unknown> = {
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
    TableName: BANKING_CORE_TABLE,
    Key: key,
    ConditionExpression: "#status = :fromStatus",
    UpdateExpression: `SET ${assignmentKeys.join(", ")}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: "ALL_NEW"
  };
};

const toUserProfileItem = (profile: UserProfileRecord): DynamoItem => ({
  PK: pk.user(profile.userId),
  SK: sk.profile(),
  entityType: "USER_PROFILE",
  userId: profile.userId,
  status: profile.status,
  createdAtIso: profile.createdAtIso,
  updatedAtIso: profile.updatedAtIso,
  GSI1PK: pk.user(profile.userId),
  GSI1SK: "PROFILE"
});

const toSplitRuleItem = (rule: SplitRuleRecord): DynamoItem => ({
  PK: pk.user(rule.userId),
  SK: sk.rule(rule.ruleId),
  entityType: "SPLIT_RULE",
  userId: rule.userId,
  ruleId: rule.ruleId,
  destinationAccountId: rule.destinationAccountId,
  percentage: rule.percentage,
  priority: rule.priority,
  isActive: rule.isActive,
  createdAtIso: rule.createdAtIso,
  updatedAtIso: rule.updatedAtIso,
  GSI1PK: pk.user(rule.userId),
  GSI1SK: `RULE#${rule.priority.toString().padStart(6, "0")}#${rule.ruleId}`
});

const toEventItem = (event: EventMetadataRecord): DynamoItem => ({
  PK: pk.event(event.eventId),
  SK: sk.eventMetadata(),
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
  GSI1PK: pk.user(event.userId),
  GSI1SK: `EVENT#${event.postedAtIso}#${event.eventId}`
});

const toExecutionItem = (execution: ExecutionSummaryRecord): DynamoItem => ({
  PK: pk.execution(execution.executionId),
  SK: sk.summary(),
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
  GSI1PK: pk.user(execution.userId),
  GSI1SK: `EXEC#${execution.createdAtIso}#${execution.executionId}`
});

const toTransferLegItem = (leg: TransferLegRecord): DynamoItem => ({
  PK: pk.execution(leg.executionId),
  SK: sk.leg(leg.legId),
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
  GSI1PK: pk.execution(leg.executionId),
  GSI1SK: sk.leg(leg.legId)
});

const toIdempotencyItem = (record: IdempotencyRecord): DynamoItem => ({
  PK: pk.idempotency(record.scope, record.key),
  SK: sk.lock(),
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

const toAuditItem = (record: AuditRecord): DynamoItem => ({
  PK: pk.audit(record.day),
  SK: sk.auditEntry(record.timestampIso, record.executionId, record.step),
  entityType: "AUDIT",
  day: record.day,
  executionId: record.executionId,
  step: record.step,
  timestampIso: record.timestampIso,
  detail: record.detail,
  GSI1PK: pk.execution(record.executionId),
  GSI1SK: `AUDIT#${record.timestampIso}#${record.step}`
});

const fromSplitRuleItem = (item: DynamoItem): SplitRuleRecord => ({
  userId: item.userId as string,
  ruleId: item.ruleId as string,
  destinationAccountId: item.destinationAccountId as string,
  percentage: item.percentage as number,
  priority: item.priority as number,
  isActive: item.isActive as boolean,
  createdAtIso: item.createdAtIso as string,
  updatedAtIso: item.updatedAtIso as string
});

const fromEventItem = (item: DynamoItem): EventMetadataRecord => ({
  eventId: item.eventId as string,
  userId: item.userId as string,
  source: item.source as "lithic" | "plaid",
  sourceAccountId: item.sourceAccountId as string,
  amountMinor: item.amountMinor as number,
  currency: item.currency as string,
  postedAtIso: item.postedAtIso as string,
  executionId: item.executionId as string | undefined,
  createdAtIso: item.createdAtIso as string
});

const fromIdempotencyItem = (item: DynamoItem): IdempotencyRecord => ({
  scope: item.scope as IdempotencyScope,
  key: item.key as string,
  status: item.status as IdempotencyStatus,
  requestHash: item.requestHash as string,
  responseHash: item.responseHash as string | undefined,
  linkedExecutionId: item.linkedExecutionId as string | undefined,
  lockExpiresAtIso: item.lockExpiresAtIso as string | undefined,
  createdAtIso: item.createdAtIso as string,
  updatedAtIso: item.updatedAtIso as string
});

class DynamoUserRepository implements UserRepository {
  public constructor(private readonly client: DynamoRepositoryClient) {}

  public async putProfileIfAbsent(profile: UserProfileRecord): Promise<void> {
    await this.client.put(buildConditionalPut(toUserProfileItem(profile)));
  }

  public async upsertSplitRule(rule: SplitRuleRecord): Promise<void> {
    await this.client.put({
      TableName: BANKING_CORE_TABLE,
      Item: toSplitRuleItem(rule)
    });
  }

  public async listSplitRules(userId: string): Promise<SplitRuleRecord[]> {
    const input: QueryItemsInput = {
      TableName: BANKING_CORE_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :rulePrefix)",
      ExpressionAttributeValues: {
        ":pk": pk.user(userId),
        ":rulePrefix": "RULE#"
      }
    };

    const result = await this.client.query(input);
    return (result.Items ?? []).map(fromSplitRuleItem);
  }
}

class DynamoEventRepository implements EventRepository {
  public constructor(private readonly client: DynamoRepositoryClient) {}

  public async putEventIfAbsent(event: EventMetadataRecord): Promise<void> {
    await this.client.put(buildConditionalPut(toEventItem(event)));
  }

  public async getEvent(eventId: string): Promise<EventMetadataRecord | null> {
    const result = await this.client.get<DynamoItem>({
      TableName: BANKING_CORE_TABLE,
      Key: {
        PK: pk.event(eventId),
        SK: sk.eventMetadata()
      }
    });

    if (!result.Item) {
      return null;
    }

    return fromEventItem(result.Item);
  }
}

class DynamoExecutionRepository implements ExecutionRepository {
  public constructor(private readonly client: DynamoRepositoryClient) {}

  public async putExecutionIfAbsent(execution: ExecutionSummaryRecord): Promise<void> {
    await this.client.put(buildConditionalPut(toExecutionItem(execution)));
  }

  public async transitionExecutionStatus(input: {
    executionId: string;
    fromStatus: ExecutionSummaryRecord["status"];
    toStatus: ExecutionSummaryRecord["status"];
    updatedAtIso: string;
    reason?: string;
  }): Promise<boolean> {
    const update = statusTransitionExpression(
      { PK: pk.execution(input.executionId), SK: sk.summary() },
      input.fromStatus,
      input.toStatus,
      input.updatedAtIso,
      { reason: input.reason }
    );

    return this.tryConditionalUpdate(update);
  }

  public async putTransferLegIfAbsent(leg: TransferLegRecord): Promise<void> {
    await this.client.put(buildConditionalPut(toTransferLegItem(leg)));
  }

  public async transitionTransferLegStatus(input: {
    executionId: string;
    legId: string;
    fromStatus: TransferLegRecord["status"];
    toStatus: TransferLegRecord["status"];
    updatedAtIso: string;
    providerTransferId?: string;
    reason?: string;
  }): Promise<boolean> {
    const update = statusTransitionExpression(
      { PK: pk.execution(input.executionId), SK: sk.leg(input.legId) },
      input.fromStatus,
      input.toStatus,
      input.updatedAtIso,
      {
        providerTransferId: input.providerTransferId,
        reason: input.reason
      }
    );

    return this.tryConditionalUpdate(update);
  }

  private async tryConditionalUpdate(input: UpdateItemInput): Promise<boolean> {
    try {
      await this.client.update(input);
      return true;
    } catch {
      return false;
    }
  }
}

class DynamoIdempotencyRepository implements IdempotencyRepository {
  public constructor(private readonly client: DynamoRepositoryClient) {}

  public async claimIfAbsent(record: IdempotencyRecord): Promise<void> {
    await this.client.put(buildConditionalPut(toIdempotencyItem(record)));
  }

  public async get(
    scope: IdempotencyScope,
    key: string
  ): Promise<IdempotencyRecord | null> {
    const result = await this.client.get<DynamoItem>({
      TableName: BANKING_CORE_TABLE,
      Key: {
        PK: pk.idempotency(scope, key),
        SK: sk.lock()
      }
    });

    if (!result.Item) {
      return null;
    }

    return fromIdempotencyItem(result.Item);
  }

  public async transitionStatus(input: {
    scope: IdempotencyScope;
    key: string;
    fromStatus: IdempotencyStatus;
    toStatus: IdempotencyStatus;
    updatedAtIso: string;
    responseHash?: string;
    linkedExecutionId?: string;
  }): Promise<boolean> {
    if (!isIdempotencyTransitionAllowed(input.fromStatus, input.toStatus)) {
      return false;
    }

    const update = statusTransitionExpression(
      { PK: pk.idempotency(input.scope, input.key), SK: sk.lock() },
      input.fromStatus,
      input.toStatus,
      input.updatedAtIso,
      {
        responseHash: input.responseHash,
        linkedExecutionId: input.linkedExecutionId,
        GSI2PK: `IDEMP#STATUS#${input.toStatus}`,
        GSI2SK: `${input.updatedAtIso}#${input.scope}#${input.key}`
      }
    );

    try {
      await this.client.update(update);
      return true;
    } catch {
      return false;
    }
  }
}

class DynamoAuditRepository implements AuditRepository {
  public constructor(private readonly client: DynamoRepositoryClient) {}

  public async append(record: AuditRecord): Promise<void> {
    await this.client.put({
      TableName: BANKING_CORE_TABLE,
      Item: toAuditItem(record)
    });
  }
}

export const createDynamoBankingCoreRepositories = (
  client: DynamoRepositoryClient
): BankingCoreRepositories => ({
  users: new DynamoUserRepository(client),
  events: new DynamoEventRepository(client),
  executions: new DynamoExecutionRepository(client),
  idempotency: new DynamoIdempotencyRepository(client),
  audit: new DynamoAuditRepository(client)
});

export const listExecutionAuditTimelineQuery = (executionId: string): QueryItemsInput => ({
  TableName: BANKING_CORE_TABLE,
  IndexName: BANKING_CORE_GSI1,
  KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :auditPrefix)",
  ExpressionAttributeValues: {
    ":gsi1pk": pk.execution(executionId),
    ":auditPrefix": "AUDIT#"
  }
});
