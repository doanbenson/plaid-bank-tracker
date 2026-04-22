import { ExecutionContext, ExecutionStatus, LegStatus } from "./execution";

export interface DepositReceivedEvent {
  source: "lithic" | "plaid";
  externalEventId: string;
  userId: string;
  accountId: string;
  amountMinor: number;
  currency: string;
  postedAtIso: string;
}

export interface ExecutionStartedEvent {
  executionId: string;
  context: ExecutionContext;
}

export interface TransferLegStatusEvent {
  executionId: string;
  legId: string;
  status: LegStatus;
  providerTransferId?: string;
  reason?: string;
}

export interface ExecutionFinalizedEvent {
  executionId: string;
  status: ExecutionStatus;
  reason?: string;
}
