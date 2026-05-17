import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { randomUUID } from "node:crypto";
import { ok, fail } from "./shared/api-response";
import { createDynamoBankingCoreRepositories } from "../repositories/dynamodb-banking-core-repositories";
import { AwsDynamoRepositoryClient } from "../repositories/aws-dynamo-repository-client";

// Step Functions client — points to LocalStack when LOCALSTACK_ENDPOINT is set
const sfnEndpoint = process.env.LOCALSTACK_ENDPOINT || process.env.AWS_ENDPOINT_URL;

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(sfnEndpoint ? { endpoint: sfnEndpoint } : {}),
});

const repo = createDynamoBankingCoreRepositories(new AwsDynamoRepositoryClient());

interface TransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number;
  currency: string;
  note?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse and validate body
    if (!event.body) {
      return fail(400, "MISSING_BODY", "Request body is required");
    }

    let body: TransferRequest;
    try {
      body = JSON.parse(event.body) as TransferRequest;
    } catch {
      return fail(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const { sourceAccountId, destinationAccountId, amountMinor, currency, note } = body;
    const userId = event.queryStringParameters?.user_id ?? event.queryStringParameters?.userId ?? "user-123";

    if (!sourceAccountId || !destinationAccountId) {
      return fail(400, "MISSING_ACCOUNTS", "sourceAccountId and destinationAccountId are required");
    }
    if (sourceAccountId === destinationAccountId) {
      return fail(400, "SAME_ACCOUNT", "Source and destination accounts must differ");
    }
    if (!amountMinor || typeof amountMinor !== "number" || amountMinor <= 0) {
      return fail(400, "INVALID_AMOUNT", "amountMinor must be a positive integer (cents)");
    }

    const executionId = randomUUID();
    const legId = randomUUID();
    const nowIso = new Date().toISOString();
    const stateMachineArn = process.env.STATE_MACHINE_ARN;

    // Always persist the execution record so it shows up in GET /api/transfers
    try {
      await repo.executions.putExecutionIfAbsent({
        executionId,
        userId,
        sourceEventId: `transfer-${executionId}`,
        sourceAccountId,
        sourceAmountMinor: amountMinor,
        currency: currency ?? "USD",
        status: stateMachineArn ? "PENDING" : "SIMULATED",
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      });

      // Persist the transfer leg as well
      await repo.executions.putTransferLegIfAbsent({
        executionId,
        legId,
        destinationAccountId,
        amountMinor,
        currency: currency ?? "USD",
        idempotencyKey: `${executionId}:${legId}`,
        status: stateMachineArn ? "PENDING" : "SIMULATED",
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      });
    } catch (dbError) {
      console.warn("Failed to persist execution record (non-fatal):", dbError);
    }

    if (!stateMachineArn) {
      // Fallback when State Machine is not wired (dev mode)
      // Update balances in DynamoDB to reflect the simulated transfer
      try {
        const [sourceAccounts, destAccounts] = await Promise.all([
          repo.accounts.getAccountsByUser(userId),
          repo.accounts.getAccountsByUser(userId),
        ]);
        const sourceAcct = sourceAccounts.find(a => a.accountId === sourceAccountId);
        const destAcct = destAccounts.find(a => a.accountId === destinationAccountId);
        const transferAmount = amountMinor / 100;

        if (sourceAcct) {
          await repo.accounts.putAccount({
            ...sourceAcct,
            balances: {
              ...sourceAcct.balances,
              current: (sourceAcct.balances.current ?? 0) - transferAmount,
              available: (sourceAcct.balances.available ?? sourceAcct.balances.current ?? 0) - transferAmount,
            },
            updatedAtIso: nowIso,
          });
        }

        if (destAcct) {
          await repo.accounts.putAccount({
            ...destAcct,
            balances: {
              ...destAcct.balances,
              current: (destAcct.balances.current ?? 0) + transferAmount,
              available: (destAcct.balances.available ?? destAcct.balances.current ?? 0) + transferAmount,
            },
            updatedAtIso: nowIso,
          });
        }
      } catch (balanceError) {
        console.warn("Failed to update balances (non-fatal):", balanceError);
      }

      return ok({
        executionId,
        status: "SIMULATED",
        message: "Transfer simulated (STATE_MACHINE_ARN not configured)",
        sourceAccountId,
        destinationAccountId,
        amountMinor,
        currency: currency ?? "USD",
      }, 202);
    }

    const executionInput = {
      executionId,
      correlationId: executionId,
      leg: {
        legId,
        destinationAccountId,
        amountMinor,
        idempotencyKey: `${executionId}:${legId}`,
      },
      sourceAccountId,
      currency: currency ?? "USD",
      note: note ?? "",
    };

    const command = new StartExecutionCommand({
      stateMachineArn,
      name: executionId,
      input: JSON.stringify(executionInput),
    });

    await sfnClient.send(command);

    return ok({
      executionId,
      status: "INITIATED",
      message: "Transfer execution started",
      sourceAccountId,
      destinationAccountId,
      amountMinor,
      currency: currency ?? "USD",
    }, 202);
  } catch (error: unknown) {
    console.error("Transfer initiation failed", error);
    return fail(500, "INTERNAL_ERROR", "Failed to initiate transfer", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
