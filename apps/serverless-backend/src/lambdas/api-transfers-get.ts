import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ok, fail } from "./shared/api-response";
import { AwsDynamoRepositoryClient } from "../repositories/aws-dynamo-repository-client";
import { BANKING_CORE_TABLE, pk } from "../dynamodb/keys";
import { BANKING_CORE_GSI1 } from "../dynamodb/schema";

const client = new AwsDynamoRepositoryClient();

/**
 * GET /api/transfers
 * Returns all execution summaries (transfers) for a given user, optionally
 * filtered by status (e.g. ?status=IN_PROGRESS,PENDING).
 *
 * Each execution is enriched with the destinationAccountId from its transfer leg.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.queryStringParameters?.user_id ?? event.queryStringParameters?.userId ?? "user-123";
    const statusFilter = event.queryStringParameters?.status;

    // Query GSI1 for executions: GSI1PK = USER#<userId>, GSI1SK begins_with EXEC#
    const result = await client.query({
      TableName: BANKING_CORE_TABLE,
      IndexName: BANKING_CORE_GSI1,
      KeyConditionExpression: "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :prefix)",
      ExpressionAttributeValues: {
        ":gsi1pk": pk.user(userId),
        ":prefix": "EXEC#",
      },
    });

    interface ExecutionItem {
      executionId?: string;
      status?: string;
      sourceAccountId?: string;
      sourceAmountMinor?: number;
      currency?: string;
      createdAtIso?: string;
      updatedAtIso?: string;
      [key: string]: unknown;
    }

    const executions = ((result.Items ?? []) as ExecutionItem[]);

    // For each execution, look up its transfer legs to get destinationAccountId
    const transferPromises = executions.map(async (item) => {
      const execId = item.executionId ?? "";
      let destinationAccountId = "";

      // Query the execution's transfer legs from the main table
      try {
        const legResult = await client.query({
          TableName: BANKING_CORE_TABLE,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :legPrefix)",
          ExpressionAttributeValues: {
            ":pk": pk.execution(execId),
            ":legPrefix": "LEG#",
          },
        });

        const legs = (legResult.Items ?? []) as Record<string, unknown>[];
        if (legs.length > 0) {
          destinationAccountId = (legs[0].destinationAccountId as string) ?? "";
        }
      } catch (legErr) {
        console.warn(`Failed to fetch legs for execution ${execId}:`, legErr);
      }

      return {
        executionId: execId,
        status: item.status ?? "UNKNOWN",
        sourceAccountId: item.sourceAccountId ?? "",
        destinationAccountId,
        amountMinor: item.sourceAmountMinor ?? 0,
        currency: item.currency ?? "USD",
        createdAt: item.createdAtIso ?? "",
        updatedAt: item.updatedAtIso ?? "",
      };
    });

    let transfers = await Promise.all(transferPromises);

    // Apply status filter if provided (comma-separated)
    if (statusFilter) {
      const statuses = statusFilter.split(",").map((s) => s.trim().toUpperCase());
      transfers = transfers.filter((t) => statuses.includes(t.status));
    }

    // Sort by most recent first
    transfers.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

    return ok({ transfers });
  } catch (error: unknown) {
    console.error("Failed to fetch transfers", error);
    return fail(500, "INTERNAL_ERROR", "Failed to fetch transfers", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
