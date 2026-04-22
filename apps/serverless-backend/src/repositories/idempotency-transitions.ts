import { IdempotencyStatus } from "./types";

const allowedTransitions: Record<IdempotencyStatus, ReadonlyArray<IdempotencyStatus>> = {
  RECEIVED: ["IN_PROGRESS", "FAILED"],
  IN_PROGRESS: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: ["IN_PROGRESS"]
};

export const isIdempotencyTransitionAllowed = (
  fromStatus: IdempotencyStatus,
  toStatus: IdempotencyStatus
): boolean => allowedTransitions[fromStatus].includes(toStatus);
