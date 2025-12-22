'use client';

import { useEffect, useState } from 'react';
import { accountsApi, transactionsApi } from '@/lib/api-client';
import AccountCard from '@/components/bank/AccountCard';
import TransactionList from '@/components/bank/TransactionList';
import PlaidLinkButton from '@/components/bank/PlaidLinkButton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsData, transactionsData] = await Promise.all([
        accountsApi.getAll(),
        transactionsApi.getAll(),
      ]);
      
      setAccounts(accountsData.accounts || []);
      setTransactions(transactionsData.transactions || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLinkSuccess = (data: any) => {
    console.log('Account linked successfully:', data);
    // Refresh data after linking
    fetchData();
  };

  const handleAccountClick = (accountId: string) => {
    setSelectedAccount(accountId);
  };

  const displayedTransactions = selectedAccount
    ? transactions.filter((t) => t.account_id === selectedAccount)
    : transactions;

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + (acc.balance.current || 0),
    0
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your accounts and transactions
          </p>
        </div>
        <PlaidLinkButton
          onSuccess={handleLinkSuccess}
          onError={(error) => console.error('Link error:', error)}
        />
      </div>

      {/* Total Balance */}
      {accounts.length > 0 && (
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
          <p className="text-sm opacity-90">Total Balance</p>
          <p className="text-4xl font-bold mt-2">{formatCurrency(totalBalance)}</p>
          <p className="text-sm opacity-75 mt-1">Across {accounts.length} accounts</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-4">No accounts linked</h2>
          <p className="text-muted-foreground mb-6">
            Link your bank account to get started
          </p>
          <PlaidLinkButton
            onSuccess={handleLinkSuccess}
            buttonText="Link Your First Account"
            variant="default"
          />
        </div>
      ) : (
        <>
          {/* Accounts Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Your Accounts</h2>
              {selectedAccount && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAccount(null)}
                >
                  View All
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <AccountCard
                  key={account.account_id}
                  account={account}
                  onClick={() => handleAccountClick(account.account_id)}
                />
              ))}
            </div>
          </div>

          <Separator className="my-8" />

          {/* Transactions Section */}
          <div>
            <TransactionList
              transactions={displayedTransactions}
              title={
                selectedAccount
                  ? `Transactions for ${
                      accounts.find((a) => a.account_id === selectedAccount)?.name
                    }`
                  : 'All Transactions'
              }
              description={
                selectedAccount
                  ? 'Filtered by selected account'
                  : 'Your recent activity across all accounts'
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
