export const BANKING_CORE_TABLE = "BankingCore";

export const ENTITY_PREFIX = {
  user: "USER",
  rule: "RULE",
  event: "EVENT",
  execution: "EXEC",
  leg: "LEG",
  idempotency: "IDEMP",
  audit: "AUDIT"
} as const;

export const pk = {
  user: (userId: string) => `${ENTITY_PREFIX.user}#${userId}`,
  rule: (ruleId: string) => `${ENTITY_PREFIX.rule}#${ruleId}`,
  event: (eventId: string) => `${ENTITY_PREFIX.event}#${eventId}`,
  execution: (executionId: string) => `${ENTITY_PREFIX.execution}#${executionId}`,
  leg: (legId: string) => `${ENTITY_PREFIX.leg}#${legId}`,
  idempotency: (scope: "webhook" | "transfer" | "compensation", key: string) =>
    `${ENTITY_PREFIX.idempotency}#${scope}#${key}`,
  audit: (yyyymmdd: string) => `${ENTITY_PREFIX.audit}#${yyyymmdd}`
};

export const sk = {
  profile: () => "PROFILE",
  rule: (ruleId: string) => `${ENTITY_PREFIX.rule}#${ruleId}`,
  eventMetadata: () => "METADATA",
  summary: () => "SUMMARY",
  leg: (legId: string) => `${ENTITY_PREFIX.leg}#${legId}`,
  lock: () => "LOCK",
  auditEntry: (timestampIso: string, executionId: string, step: string) =>
    `${timestampIso}#${executionId}#${step}`
};
