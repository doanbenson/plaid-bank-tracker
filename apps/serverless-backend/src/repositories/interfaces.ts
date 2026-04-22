import { ExecutionStatus, LegStatus } from "../contracts/execution";
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

export interface UserRepository {
  putProfileIfAbsent(profile: UserProfileRecord): Promise<void>;
  upsertSplitRule(rule: SplitRuleRecord): Promise<void>;
  listSplitRules(userId: string): Promise<SplitRuleRecord[]>;
}

export interface EventRepository {
  putEventIfAbsent(event: EventMetadataRecord): Promise<void>;
  getEvent(eventId: string): Promise<EventMetadataRecord | null>;
}

export interface ExecutionRepository {
  putExecutionIfAbsent(execution: ExecutionSummaryRecord): Promise<void>;
  transitionExecutionStatus(input: {
    executionId: string;
    fromStatus: ExecutionStatus;
    toStatus: ExecutionStatus;
    updatedAtIso: string;
    reason?: string;
  }): Promise<boolean>;
  putTransferLegIfAbsent(leg: TransferLegRecord): Promise<void>;
  transitionTransferLegStatus(input: {
    executionId: string;
    legId: string;
    fromStatus: LegStatus;
    toStatus: LegStatus;
    updatedAtIso: string;
    providerTransferId?: string;
    reason?: string;
  }): Promise<boolean>;
}

export interface IdempotencyRepository {
  claimIfAbsent(record: IdempotencyRecord): Promise<void>;
  get(scope: IdempotencyScope, key: string): Promise<IdempotencyRecord | null>;
  transitionStatus(input: {
    scope: IdempotencyScope;
    key: string;
    fromStatus: IdempotencyStatus;
    toStatus: IdempotencyStatus;
    updatedAtIso: string;
    responseHash?: string;
    linkedExecutionId?: string;
  }): Promise<boolean>;
}

export interface AuditRepository {
  append(record: AuditRecord): Promise<void>;
}

export interface BankingCoreRepositories {
  readonly users: UserRepository;
  readonly events: EventRepository;
  readonly executions: ExecutionRepository;
  readonly idempotency: IdempotencyRepository;
  readonly audit: AuditRepository;
}
