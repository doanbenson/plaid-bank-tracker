import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { fail, ok } from "./shared/api-response";
import { createPlaidClient, getPlaidEnvironment } from "./shared/plaid-client";

/**
 * POST /api/sandbox/transfer/simulate
 *
 * Uses Plaid's /sandbox/transfer/simulate to advance a transfer through
 * its lifecycle. Accepts { transfer_id, event_type } in the body.
 *
 * Valid event_type values: "posted" | "settled" | "failed" | "returned" | "funds_available"
 *
 * Compatible transitions:
 *   pending  → failed
 *   pending  → posted
 *   posted   → returned
 *   posted   → settled
 *   settled  → funds_available  (ACH debits only)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (getPlaidEnvironment() !== "sandbox") {
      return fail(
        400,
        "SANDBOX_ONLY",
        "Transfer simulation is only available in the sandbox environment."
      );
    }

    if (!event.body) {
      return fail(400, "MISSING_BODY", "Request body is required");
    }

    let body: { transfer_id: string; event_type: string; failure_reason?: { failure_code?: string; description?: string } };
    try {
      body = JSON.parse(event.body);
    } catch {
      return fail(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const { transfer_id, event_type, failure_reason } = body;

    if (!transfer_id) {
      return fail(400, "MISSING_TRANSFER_ID", "transfer_id is required");
    }

    const validEvents = ["posted", "settled", "failed", "returned", "funds_available"];
    if (!event_type || !validEvents.includes(event_type)) {
      return fail(
        400,
        "INVALID_EVENT_TYPE",
        `event_type must be one of: ${validEvents.join(", ")}`
      );
    }

    const plaidClient = await createPlaidClient();

    const simulateRequest: any = {
      transfer_id,
      event_type,
    };

    if (failure_reason) {
      simulateRequest.failure_reason = failure_reason;
    }

    const response = await plaidClient.sandboxTransferSimulate(simulateRequest);

    return ok({
      simulated: true,
      transfer_id,
      event_type,
      request_id: response.data?.request_id,
    });
  } catch (error: unknown) {
    console.error("Sandbox transfer simulate failed:", error);
    return fail(500, "SIMULATE_FAILED", "Failed to simulate transfer event", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
