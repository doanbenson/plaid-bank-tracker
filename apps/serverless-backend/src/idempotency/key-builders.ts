import { createHash } from "node:crypto";

import { DepositReceivedEvent, TransferLegStatusEvent } from "../contracts/events";

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

export const buildInboundWebhookIdempotencyKey = (
  event: DepositReceivedEvent
): string => {
  const canonical = [
    event.source,
    event.externalEventId,
    event.accountId,
    event.amountMinor.toString(),
    event.currency,
    event.postedAtIso
  ].join("|");

  return sha256(canonical);
};

export const buildTransferLegIdempotencyKey = (input: {
  executionId: string;
  legId: string;
  destinationAccountId: string;
  amountMinor: number;
  currency: string;
}): string =>
  sha256(
    [
      input.executionId,
      input.legId,
      input.destinationAccountId,
      input.amountMinor.toString(),
      input.currency
    ].join("|")
  );

export const buildCompensationIdempotencyKey = (input: {
  executionId: string;
  legEvent: TransferLegStatusEvent;
}): string =>
  sha256(
    [
      input.executionId,
      input.legEvent.legId,
      input.legEvent.providerTransferId ?? "NO_PROVIDER_TRANSFER_ID",
      "COMPENSATION"
    ].join("|")
  );
