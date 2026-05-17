import apiClient from '../core/client';
import type { Transfer } from '../types/domain';

export interface InitiateTransferRequest {
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number; // in cents
  currency: string;
  note?: string;
}

export interface InitiateTransferResponse {
  executionId: string;
  status: string;
  message?: string;
}

export interface SimulateTransferRequest {
  transfer_id: string;
  event_type: 'posted' | 'settled' | 'failed' | 'returned' | 'funds_available';
  failure_reason?: {
    failure_code?: string;
    description?: string;
  };
}

export interface SimulateTransferResponse {
  simulated: boolean;
  transfer_id: string;
  event_type: string;
  request_id?: string;
}

export const transferApi = {
  initiateTransfer: async (request: InitiateTransferRequest): Promise<InitiateTransferResponse> => {
    const response = await apiClient.post<InitiateTransferResponse>(
      '/api/transfers',
      request
    );
    return response.data;
  },

  /**
   * Fetch all transfers for the current user, optionally filtered by status.
   * Pass comma-separated statuses like "PENDING,IN_PROGRESS" to filter.
   */
  getAll: async (statusFilter?: string): Promise<Transfer[]> => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;

    const response = await apiClient.get<{ transfers: Transfer[] }>(
      '/api/transfers',
      { params }
    );
    return response.data.transfers ?? [];
  },

  /**
   * Simulate a Plaid transfer event in the sandbox environment.
   * Use this to advance a transfer through its lifecycle:
   *   pending → posted → settled → funds_available
   *   pending → failed
   *   posted  → returned
   */
  simulate: async (request: SimulateTransferRequest): Promise<SimulateTransferResponse> => {
    const response = await apiClient.post<SimulateTransferResponse>(
      '/api/sandbox/transfer/simulate',
      request
    );
    return response.data;
  },
};
