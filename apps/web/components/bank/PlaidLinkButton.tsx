'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AxiosError } from 'axios';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { API_BASE_URL, plaidApi } from '@/lib/api-client';

type PlaidLinkSuccessData = Awaited<ReturnType<typeof plaidApi.exchangePublicToken>>;

interface PlaidErrorResponse {
  error?: string;
}

interface PlaidLinkButtonProps {
  onSuccess?: (data: PlaidLinkSuccessData) => void;
  onError?: (error: unknown) => void;
  userId?: string;
  buttonText?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
}

export default function PlaidLinkButton({
  onSuccess,
  onError,
  userId = 'user-sandbox',
  buttonText = 'Link Bank Account',
  variant = 'default',
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const fetchLinkToken = useCallback(async () => {
    try {
      setLinkError(null);
      const data = await plaidApi.createLinkToken(userId);
      if (data.link_token) {
        setLinkToken(data.link_token);
      } else {
        setLinkError('Link token missing from API response.');
        console.error('No link token in response:', data);
      }
    } catch (error: unknown) {
      const axiosError = error as AxiosError<PlaidErrorResponse>;
      const message = axiosError.response?.data?.error ?? axiosError.message;
      setLinkToken(null);
      setLinkError(message || 'Unable to fetch Plaid link token.');
      console.error(`Error fetching link token from ${API_BASE_URL}:`, error);
      onError?.(error);
    }
  }, [onError, userId]);

  // Fetch link token on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchLinkToken();
    }, 0);

    return () => clearTimeout(timeout);
  }, [fetchLinkToken]);

  // Handle successful Plaid Link flow
  const handlePlaidSuccess = useCallback(
    async (publicToken: string) => {
      setLoading(true);
      try {
        const exchangeData = await plaidApi.exchangePublicToken(publicToken, userId);
        await plaidApi.syncTransactions(exchangeData.item_id, exchangeData.access_token);
        onSuccess?.(exchangeData);
      } catch (error: unknown) {
        console.error('Error exchanging token:', error);
        const axiosError = error as AxiosError<PlaidErrorResponse>;
        const message = axiosError.response?.data?.error ?? axiosError.message;
        alert(`Error: ${message}`);
        onError?.(error);
      } finally {
        window.location.reload();
        setLoading(false);
      }
    },
    [onError, onSuccess, userId]
  );

  // Initialize Plaid Link
  const config = {
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: (error: unknown) => {
      if (error) {
        console.error('Plaid Link exited with error:', error);
        onError?.(error);
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready) {
      open();
      return;
    }

    if (linkError && !loading) {
      void fetchLinkToken();
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading || (!ready && !linkError)}
      variant={variant}
    >
      {loading ? 'Processing...' : ready ? buttonText : linkError ? 'Retry Link Setup' : 'Loading Link...'}
    </Button>
  );
}
