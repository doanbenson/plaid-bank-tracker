import { BANKING_CORE_TABLE, pk, sk } from "../dynamodb/keys";

type InboundSource = "lithic" | "plaid";

export interface AcquireInboundIdempotencyLockInput {
  source: InboundSource;
  idempotencyKey: string;
  externalEventId: string;
  receivedAtIso: string;
  ttlSeconds?: number;
}

export type AcquireInboundIdempotencyLockResult =
  | {
      status: "ACQUIRED";
      lockPartitionKey: string;
      lockSortKey: string;
      expiresAtEpochSeconds: number;
    }
  | {
      status: "DUPLICATE";
      lockPartitionKey: string;
      lockSortKey: string;
    };

export interface InboundIdempotencyLockRepository {
  acquireInboundLock(
    input: AcquireInboundIdempotencyLockInput
  ): Promise<AcquireInboundIdempotencyLockResult>;
}

export class InMemoryInboundIdempotencyLockRepository
  implements InboundIdempotencyLockRepository
{
  private readonly locks = new Map<string, number>();

  async acquireInboundLock(
    input: AcquireInboundIdempotencyLockInput
  ): Promise<AcquireInboundIdempotencyLockResult> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAtEpochSeconds = nowSeconds + (input.ttlSeconds ?? 60 * 60 * 24);
    const lockPartitionKey = pk.idempotency("webhook", input.idempotencyKey);
    const lockSortKey = sk.lock();

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

export interface DynamoDbConditionalPutClient {
  putIfAbsent(input: {
    tableName: string;
    partitionKey: string;
    sortKey: string;
    item: Record<string, unknown>;
  }): Promise<boolean>;
}

export class DynamoDbConditionalPutInboundIdempotencyLockRepository
  implements InboundIdempotencyLockRepository
{
  constructor(
    private readonly client: DynamoDbConditionalPutClient,
    private readonly tableName: string = BANKING_CORE_TABLE
  ) {}

  async acquireInboundLock(
    input: AcquireInboundIdempotencyLockInput
  ): Promise<AcquireInboundIdempotencyLockResult> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAtEpochSeconds = nowSeconds + (input.ttlSeconds ?? 60 * 60 * 24);
    const lockPartitionKey = pk.idempotency("webhook", input.idempotencyKey);
    const lockSortKey = sk.lock();

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

const defaultInboundIdempotencyLockRepository =
  new InMemoryInboundIdempotencyLockRepository();

export const getDefaultInboundIdempotencyLockRepository =
  (): InboundIdempotencyLockRepository => defaultInboundIdempotencyLockRepository;
