"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultInboundIdempotencyLockRepository = exports.DynamoDbConditionalPutInboundIdempotencyLockRepository = exports.InMemoryInboundIdempotencyLockRepository = void 0;
const keys_1 = require("../dynamodb/keys");
class InMemoryInboundIdempotencyLockRepository {
    locks = new Map();
    async acquireInboundLock(input) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const expiresAtEpochSeconds = nowSeconds + (input.ttlSeconds ?? 60 * 60 * 24);
        const lockPartitionKey = keys_1.pk.idempotency("webhook", input.idempotencyKey);
        const lockSortKey = keys_1.sk.lock();
        for (const [lockKey, expiresAt] of this.locks.entries()) {
            if (expiresAt <= nowSeconds) {
                this.locks.delete(lockKey);
            }
        }
        const lockIdentity = `${lockPartitionKey}|${lockSortKey}`;
        if (this.locks.has(lockIdentity)) {
            return {
                status: "DUPLICATE",
                lockPartitionKey,
                lockSortKey
            };
        }
        this.locks.set(lockIdentity, expiresAtEpochSeconds);
        return {
            status: "ACQUIRED",
            lockPartitionKey,
            lockSortKey,
            expiresAtEpochSeconds
        };
    }
}
exports.InMemoryInboundIdempotencyLockRepository = InMemoryInboundIdempotencyLockRepository;
class DynamoDbConditionalPutInboundIdempotencyLockRepository {
    client;
    tableName;
    constructor(client, tableName = keys_1.BANKING_CORE_TABLE) {
        this.client = client;
        this.tableName = tableName;
    }
    async acquireInboundLock(input) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const expiresAtEpochSeconds = nowSeconds + (input.ttlSeconds ?? 60 * 60 * 24);
        const lockPartitionKey = keys_1.pk.idempotency("webhook", input.idempotencyKey);
        const lockSortKey = keys_1.sk.lock();
        const inserted = await this.client.putIfAbsent({
            tableName: this.tableName,
            partitionKey: lockPartitionKey,
            sortKey: lockSortKey,
            item: {
                PK: lockPartitionKey,
                SK: lockSortKey,
                scope: "webhook",
                source: input.source,
                externalEventId: input.externalEventId,
                status: "IN_PROGRESS",
                createdAtIso: input.receivedAtIso,
                expiresAt: expiresAtEpochSeconds
            }
        });
        if (!inserted) {
            return {
                status: "DUPLICATE",
                lockPartitionKey,
                lockSortKey
            };
        }
        return {
            status: "ACQUIRED",
            lockPartitionKey,
            lockSortKey,
            expiresAtEpochSeconds
        };
    }
}
exports.DynamoDbConditionalPutInboundIdempotencyLockRepository = DynamoDbConditionalPutInboundIdempotencyLockRepository;
const defaultInboundIdempotencyLockRepository = new InMemoryInboundIdempotencyLockRepository();
const getDefaultInboundIdempotencyLockRepository = () => defaultInboundIdempotencyLockRepository;
exports.getDefaultInboundIdempotencyLockRepository = getDefaultInboundIdempotencyLockRepository;
