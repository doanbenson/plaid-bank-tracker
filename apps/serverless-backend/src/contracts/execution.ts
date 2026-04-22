export type ExecutionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUCCEEDED"
  | "FAILED_NO_SIDE_EFFECTS"
  | "FAILED_COMPENSATED"
  | "FAILED_COMPENSATION_REQUIRED_MANUAL";

export type LegStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUCCEEDED"
  | "FAILED";

export interface SplitRule {
  ruleId: string;
  destinationAccountId: string;
  percentage: number;
  priority: number;
  isActive: boolean;
}

export interface TransferLegPlan {
  legId: string;
  destinationAccountId: string;
  amountMinor: number;
  idempotencyKey: string;
}

export interface ExecutionContext {
  executionId: string;
  userId: string;
  sourceEventId: string;
  sourceAccountId: string;
  sourceAmountMinor: number;
  currency: string;
  legs: TransferLegPlan[];
}
