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

const conditionalWriteError = (): Error => new Error("ConditionalCheckFailed");

class InMemoryUserRepository implements UserRepository {
  private readonly profiles = new Map<string, UserProfileRecord>();
  private readonly rulesByUser = new Map<string, Map<string, SplitRuleRecord>>();

  public async putProfileIfAbsent(profile: UserProfileRecord): Promise<void> {
    if (this.profiles.has(profile.userId)) {
      throw conditionalWriteError();
    }
    this.profiles.set(profile.userId, profile);
  }

  public async upsertSplitRule(rule: SplitRuleRecord): Promise<void> {
    const userRules = this.rulesByUser.get(rule.userId) ?? new Map<string, SplitRuleRecord>();
    userRules.set(rule.ruleId, rule);
    this.rulesByUser.set(rule.userId, userRules);
  }

  public async listSplitRules(userId: string): Promise<SplitRuleRecord[]> {
    const userRules = this.rulesByUser.get(userId);
    return userRules ? [...userRules.values()].sort((a, b) => a.priority - b.priority) : [];
  }
}

class InMemoryEventRepository implements EventRepository {
  private readonly events = new Map<string, EventMetadataRecord>();

  public async putEventIfAbsent(event: EventMetadataRecord): Promise<void> {
    if (this.events.has(event.eventId)) {
      throw conditionalWriteError();
    }
    this.events.set(event.eventId, event);
  }

  public async getEvent(eventId: string): Promise<EventMetadataRecord | null> {
    return this.events.get(eventId) ?? null;
  }
}

class InMemoryExecutionRepository implements ExecutionRepository {
  private readonly executions = new Map<string, ExecutionSummaryRecord>();
  private readonly legs = new Map<string, TransferLegRecord>();

  public async putExecutionIfAbsent(execution: ExecutionSummaryRecord): Promise<void> {
    if (this.executions.has(execution.executionId)) {
      throw conditionalWriteError();
    }
    this.executions.set(execution.executionId, execution);
  }

  public async transitionExecutionStatus(input: {
    executionId: string;
    fromStatus: ExecutionSummaryRecord["status"];
    toStatus: ExecutionSummaryRecord["status"];
    updatedAtIso: string;
    reason?: string;
  }): Promise<boolean> {
    const current = this.executions.get(input.executionId);
    if (!current || current.status !== input.fromStatus) {
      return false;
    }

    this.executions.set(input.executionId, {
      ...current,
      status: input.toStatus,
      updatedAtIso: input.updatedAtIso
    });
    return true;
  }

  public async putTransferLegIfAbsent(leg: TransferLegRecord): Promise<void> {
    const key = `${leg.executionId}|${leg.legId}`;
    if (this.legs.has(key)) {
      throw conditionalWriteError();
    }
    this.legs.set(key, leg);
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
    const key = `${input.executionId}|${input.legId}`;
    const current = this.legs.get(key);
    if (!current || current.status !== input.fromStatus) {
      return false;
    }

    this.legs.set(key, {
      ...current,
      status: input.toStatus,
      updatedAtIso: input.updatedAtIso,
      providerTransferId: input.providerTransferId ?? current.providerTransferId,
      reason: input.reason ?? current.reason
    });
    return true;
  }
}

class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly records = new Map<string, IdempotencyRecord>();

  public async claimIfAbsent(record: IdempotencyRecord): Promise<void> {
    const key = this.toStorageKey(record.scope, record.key);
    if (this.records.has(key)) {
      throw conditionalWriteError();
    }
    this.records.set(key, record);
  }

  public async get(scope: IdempotencyScope, key: string): Promise<IdempotencyRecord | null> {
    return this.records.get(this.toStorageKey(scope, key)) ?? null;
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

    const key = this.toStorageKey(input.scope, input.key);
    const current = this.records.get(key);
    if (!current || current.status !== input.fromStatus) {
      return false;
    }

    this.records.set(key, {
      ...current,
      status: input.toStatus,
      updatedAtIso: input.updatedAtIso,
      responseHash: input.responseHash ?? current.responseHash,
      linkedExecutionId: input.linkedExecutionId ?? current.linkedExecutionId
    });
    return true;
  }

  private toStorageKey(scope: IdempotencyScope, key: string): string {
    return `${scope}|${key}`;
  }
}

class InMemoryAuditRepository implements AuditRepository {
  public readonly records: AuditRecord[] = [];

  public async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }
}

export const createInMemoryBankingCoreRepositories = (): BankingCoreRepositories => ({
  users: new InMemoryUserRepository(),
  events: new InMemoryEventRepository(),
  executions: new InMemoryExecutionRepository(),
  idempotency: new InMemoryIdempotencyRepository(),
  audit: new InMemoryAuditRepository()
});
