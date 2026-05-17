export type AccountType = 'depository' | 'credit' | 'investment' | 'loan' | 'brokerage';

export type AccountBalance = {
  available: number | null;
  current: number | null;
  limit: number | null;
};

export type Account = {
  account_id: string;
  name: string;
  mask?: string;
  type: AccountType;
  subtype: string;
  balance: AccountBalance;
};

export type Transaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category: string[];
  pending: boolean;
};

export type TransferStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'SIMULATED' | 'INITIATED' | 'UNKNOWN';

export type Transfer = {
  executionId: string;
  status: TransferStatus;
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};
