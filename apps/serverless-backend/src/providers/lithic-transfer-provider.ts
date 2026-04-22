import { createHash } from "node:crypto";

import { ProviderTerminalError } from "../errors/provider-errors";

export interface LithicIdempotentHeaders {
  "Idempotency-Key": string;
}

export const buildLithicIdempotentHeaders = (idempotencyKey: string): LithicIdempotentHeaders => ({
  "Idempotency-Key": idempotencyKey
});

export interface CreateLithicTransferInput {
  executionId: string;
  legId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}

export interface ReverseLithicTransferInput {
  executionId: string;
  legId: string;
  providerTransferId: string;
  reason: string;
  idempotencyKey: string;
}

export interface LithicTransferProvider {
  createTransfer(input: CreateLithicTransferInput): Promise<{ providerTransferId: string }>;
  reverseTransfer(input: ReverseLithicTransferInput): Promise<{ providerCompensationId: string }>;
}

const deterministicId = (prefix: string, source: string): string =>
  `${prefix}-${createHash("sha256").update(source, "utf8").digest("hex").slice(0, 16)}`;

export class MockLithicTransferProvider implements LithicTransferProvider {
  public async createTransfer(input: CreateLithicTransferInput): Promise<{ providerTransferId: string }> {
    if (input.amountMinor <= 0) {
      throw new ProviderTerminalError("Amount must be positive", "INVALID_AMOUNT");
    }

    const headers = buildLithicIdempotentHeaders(input.idempotencyKey);
    return {
      providerTransferId: deterministicId(
        "lithic-transfer",
        [
          input.executionId,
          input.legId,
          input.sourceAccountId,
          input.destinationAccountId,
          input.amountMinor.toString(),
          input.currency,
          headers["Idempotency-Key"]
        ].join("|")
      )
    };
  }

  public async reverseTransfer(
    input: ReverseLithicTransferInput
  ): Promise<{ providerCompensationId: string }> {
    if (!input.providerTransferId) {
      throw new ProviderTerminalError("Provider transfer id is required", "MISSING_PROVIDER_TRANSFER_ID");
    }

    const headers = buildLithicIdempotentHeaders(input.idempotencyKey);
    return {
      providerCompensationId: deterministicId(
        "lithic-reversal",
        [input.executionId, input.legId, input.providerTransferId, input.reason, headers["Idempotency-Key"]].join(
          "|"
        )
      )
    };
  }
}

const defaultLithicTransferProvider = new MockLithicTransferProvider();

export const getDefaultLithicTransferProvider = (): LithicTransferProvider =>
  defaultLithicTransferProvider;
