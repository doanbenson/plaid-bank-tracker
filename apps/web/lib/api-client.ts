import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Plaid API
export const plaidApi = {
  createLinkToken: async (userId: string = 'user-sandbox') => {
    const response = await apiClient.post('/api/plaid/create-link-token', { user_id: userId });
    return response.data;
  },

  exchangePublicToken: async (publicToken: string, userId: string = 'user-sandbox') => {
    const response = await apiClient.post('/api/plaid/exchange-token', {
      public_token: publicToken,
      user_id: userId,
    });
    return response.data;
  },

  syncTransactions: async (itemId: string) => {
    const response = await apiClient.post(`/api/plaid/sync-transactions/${itemId}`);
    return response.data;
  },
};

// Accounts API
export const accountsApi = {
  getAll: async (userId?: string) => {
    const params = userId ? { user_id: userId } : {};
    const response = await apiClient.get('/api/accounts', { params });
    return response.data;
  },

  getById: async (accountId: string) => {
    const response = await apiClient.get(`/api/accounts/${accountId}`);
    return response.data;
  },
};

// Transactions API
export const transactionsApi = {
  getAll: async (userId?: string, accountId?: string) => {
    const params: any = {};
    if (userId) params.user_id = userId;
    if (accountId) params.account_id = accountId;
    
    const response = await apiClient.get('/api/transactions', { params });
    return response.data;
  },
};

export default apiClient;
