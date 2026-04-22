"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInMemoryBankingCoreRepositories = void 0;
const idempotency_transitions_1 = require("./idempotency-transitions");
const conditionalWriteError = () => new Error("ConditionalCheckFailed");
class InMemoryUserRepository {
    profiles = new Map();
    rulesByUser = new Map();
    async putProfileIfAbsent(profile) {
        if (this.profiles.has(profile.userId)) {
            throw conditionalWriteError();
        }
        this.profiles.set(profile.userId, profile);
    }
    async upsertSplitRule(rule) {
        const userRules = this.rulesByUser.get(rule.userId) ?? new Map();
        userRules.set(rule.ruleId, rule);
        this.rulesByUser.set(rule.userId, userRules);
    }
    async listSplitRules(userId) {
        const userRules = this.rulesByUser.get(userId);
        return userRules ? [...userRules.values()].sort((a, b) => a.priority - b.priority) : [];
    }
}
class InMemoryEventRepository {
    events = new Map();
    async putEventIfAbsent(event) {
        if (this.events.has(event.eventId)) {
            throw conditionalWriteError();
        }
        this.events.set(event.eventId, event);
    }
    async getEvent(eventId) {
        return this.events.get(eventId) ?? null;
    }
}
class InMemoryExecutionRepository {
    executions = new Map();
    legs = new Map();
    async putExecutionIfAbsent(execution) {
        if (this.executions.has(execution.executionId)) {
            throw conditionalWriteError();
        }
        this.executions.set(execution.executionId, execution);
    }
    async transitionExecutionStatus(input) {
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
    async putTransferLegIfAbsent(leg) {
        const key = `${leg.executionId}|${leg.legId}`;
        if (this.legs.has(key)) {
            throw conditionalWriteError();
        }
        this.legs.set(key, leg);
    }
    async transitionTransferLegStatus(input) {
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
class InMemoryIdempotencyRepository {
    records = new Map();
    async claimIfAbsent(record) {
        const key = this.toStorageKey(record.scope, record.key);
        if (this.records.has(key)) {
            throw conditionalWriteError();
        }
        this.records.set(key, record);
    }
    async get(scope, key) {
        return this.records.get(this.toStorageKey(scope, key)) ?? null;
    }
    async transitionStatus(input) {
        if (!(0, idempotency_transitions_1.isIdempotencyTransitionAllowed)(input.fromStatus, input.toStatus)) {
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
    toStorageKey(scope, key) {
        return `${scope}|${key}`;
    }
}
class InMemoryAuditRepository {
    records = [];
    async append(record) {
        this.records.push(record);
    }
}
const createInMemoryBankingCoreRepositories = () => ({
    users: new InMemoryUserRepository(),
    events: new InMemoryEventRepository(),
    executions: new InMemoryExecutionRepository(),
    idempotency: new InMemoryIdempotencyRepository(),
    audit: new InMemoryAuditRepository()
});
exports.createInMemoryBankingCoreRepositories = createInMemoryBankingCoreRepositories;
