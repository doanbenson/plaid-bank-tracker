'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AxiosError } from 'axios';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { plaidApi } from '@/lib/api-client';

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

  // Fetch link token on mount
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const data = await plaidApi.createLinkToken(userId);
        if (data.link_token) {
          setLinkToken(data.link_token);
        } else {
          console.error('No link token in response:', data);
        }
      } catch (error: unknown) {
        console.error('Error fetching link token:', error);
        onError?.(error);
      }
    };

    fetchLinkToken();
  }, [onError, userId]);

  // Handle successful Plaid Link flow
  const handlePlaidSuccess = useCallback(
    async (publicToken: string) => {
      setLoading(true);
      try {
        const exchangeData = await plaidApi.exchangePublicToken(publicToken, userId);
        onSuccess?.(exchangeData);
      } catch (error: unknown) {
        console.error('Error exchanging token:', error);
        const axiosError = error as AxiosError<PlaidErrorResponse>;
        const message = axiosError.response?.data?.error ?? axiosError.message;
        alert(`Error: ${message}`);
        onError?.(error);
      } finally {
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
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading || !ready}
      variant={variant}
    >
      {loading ? 'Processing...' : !ready ? 'Loading Link...' : buttonText}
    </Button>
  );
}