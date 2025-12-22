'use client';

import { useCallback, useState } from 'react';
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link';
import { Button } from '@/components/ui/button';
import { plaidApi } from '@/lib/api-client';

interface PlaidLinkButtonProps {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
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

  // Fetch link token from Flask backend
  const generateToken = useCallback(async () => {
    setLoading(true);
    try {
      const data = await plaidApi.createLinkToken(userId);
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error creating link token:', error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [userId, onError]);

  // Handle successful link
  const handleOnSuccess = useCallback<PlaidLinkOnSuccess>(
    async (public_token, metadata) => {
      setLoading(true);
      try {
        // Exchange public token for access token
        const data = await plaidApi.exchangePublicToken(public_token, userId);
        console.log('Successfully linked account:', data);
        onSuccess?.(data);
      } catch (error) {
        console.error('Error exchanging public token:', error);
        onError?.(error);
      } finally {
        setLoading(false);
      }
    },
    [userId, onSuccess, onError]
  );

  // Plaid Link configuration
  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: (error, metadata) => {
      if (error) {
        console.error('Plaid Link exited with error:', error);
        onError?.(error);
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  // Handle button click
  const handleClick = async () => {
    if (!linkToken) {
      await generateToken();
    } else {
      open();
    }
  };

  // Auto-open when link token is ready
  useState(() => {
    if (linkToken && ready) {
      open();
    }
  });

  return (
    <Button
      onClick={handleClick}
      disabled={loading || (linkToken !== null && !ready)}
      variant={variant}
    >
      {loading ? 'Loading...' : buttonText}
    </Button>
  );
}
