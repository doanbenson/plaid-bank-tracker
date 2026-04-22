"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sk = exports.pk = exports.ENTITY_PREFIX = exports.BANKING_CORE_TABLE = void 0;
exports.BANKING_CORE_TABLE = "BankingCore";
exports.ENTITY_PREFIX = {
    user: "USER",
    rule: "RULE",
    event: "EVENT",
    execution: "EXEC",
    leg: "LEG",
    idempotency: "IDEMP",
    audit: "AUDIT"
};
exports.pk = {
    user: (userId) => `${exports.ENTITY_PREFIX.user}#${userId}`,
    rule: (ruleId) => `${exports.ENTITY_PREFIX.rule}#${ruleId}`,
    event: (eventId) => `${exports.ENTITY_PREFIX.event}#${eventId}`,
    execution: (executionId) => `${exports.ENTITY_PREFIX.execution}#${executionId}`,
    leg: (legId) => `${exports.ENTITY_PREFIX.leg}#${legId}`,
    idempotency: (scope, key) => `${exports.ENTITY_PREFIX.idempotency}#${scope}#${key}`,
    audit: (yyyymmdd) => `${exports.ENTITY_PREFIX.audit}#${yyyymmdd}`
};
exports.sk = {
    profile: () => "PROFILE",
    rule: (ruleId) => `${exports.ENTITY_PREFIX.rule}#${ruleId}`,
    eventMetadata: () => "METADATA",
    summary: () => "SUMMARY",
    leg: (legId) => `${exports.ENTITY_PREFIX.leg}#${legId}`,
    lock: () => "LOCK",
    auditEntry: (timestampIso, executionId, step) => `${timestampIso}#${executionId}#${step}`
};
