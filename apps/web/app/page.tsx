'use client';

import { useEffect, useState } from 'react';
import { accountsApi, transactionsApi } from '@/lib/api-client';
import AccountCard from '@/components/bank/AccountCard';
import TransactionList from '@/components/bank/TransactionList';
import PlaidLinkButton from '@/components/bank/PlaidLinkButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type BankAccount = {
  account_id: string;
  name: string;
  mask?: string;
  type: string;
  subtype: string;
  balance: {
    available: number | null;
    current: number | null;
    limit: number | null;
  };
};

type Transaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category: string[];
  pending: boolean;
};

export default function Dashboard() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

  const handleLinkSuccess = (data: unknown) => {
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

  const groupedAccounts = accounts.reduce<Record<string, BankAccount[]>>((acc, account) => {
    const group = account.type === 'depository'
      ? 'Checking'
      : account.type === 'credit'
      ? 'Credit Cards'
      : account.type === 'investment'
      ? 'Investments'
      : account.type === 'loan'
      ? 'Loans'
      : 'Other Accounts';

    acc[group] = acc[group] ? [...acc[group], account] : [account];
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl lg:ml-64 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Dashboard</p>
            <h1 className="text-xl font-semibold tracking-tight">Account Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Input className="hidden w-64 rounded-full bg-card/80 md:block" placeholder="Search wealth..." />
            <Avatar className="h-9 w-9 border border-border/70">
              <AvatarFallback>EL</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-28 lg:ml-64 lg:px-8 lg:py-8 lg:pb-8">
        {accounts.length > 0 && (
          <section className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr),auto]">
            <Card className="overflow-hidden border-0 bg-linear-to-br from-primary to-chart-3 text-primary-foreground shadow-[0_24px_80px_-50px_rgba(58,47,52,0.7)]">
              <CardContent className="p-6 md:p-8">
                <p className="text-xs uppercase tracking-[0.18em] opacity-80">Total Net Liquidity</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{formatCurrency(totalBalance)}</p>
                <p className="mt-2 text-sm opacity-85">Across {accounts.length} connected accounts</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3 lg:w-[22rem]">
              <Card className="border-0 bg-secondary/20">
                <CardContent className="space-y-1 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Monthly Yield</p>
                  <p className="text-xl font-semibold tracking-tight text-foreground">+4.2%</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-accent/35">
                <CardContent className="space-y-1 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Active Banks</p>
                  <p className="text-xl font-semibold tracking-tight text-foreground">{accounts.length.toString().padStart(2, '0')}</p>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {loading ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">Loading your accounts...</p>
          </div>
        ) : accounts.length === 0 ? (
          <Card className="mx-auto max-w-xl border-0 bg-card/85 text-center shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
            <CardContent className="space-y-4 p-8">
              <h2 className="text-2xl font-semibold">No accounts linked</h2>
              <p className="text-muted-foreground">Connect your first bank account to start the dashboard.</p>
              <div className="pt-2">
                <PlaidLinkButton onSuccess={handleLinkSuccess} buttonText="Link your first account" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 xl:grid-cols-12">
            <section className="space-y-6 xl:col-span-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-tight">Connected Institutions</h2>
                {selectedAccount && (
                  <Button variant="secondary" size="sm" onClick={() => setSelectedAccount(null)}>
                    View all
                  </Button>
                )}
              </div>

              {Object.entries(groupedAccounts).map(([groupName, groupAccounts]) => {
                const groupTotal = groupAccounts.reduce((sum, account) => sum + (account.balance.current || 0), 0);

                return (
                  <Card key={groupName} className="border-0 bg-card/85 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-4">
                        <CardTitle className="text-base font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                          {groupName}
                        </CardTitle>
                        <Badge variant="secondary" className="rounded-full text-xs uppercase tracking-[0.12em]">
                          {formatCurrency(groupTotal)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {groupAccounts.map((account) => (
                        <AccountCard
                          key={account.account_id}
                          account={account}
                          onClick={() => handleAccountClick(account.account_id)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                );
              })}

              <Separator className="bg-border/65" />

              <TransactionList
                transactions={displayedTransactions}
                title={
                  selectedAccount
                    ? `Transactions for ${accounts.find((a) => a.account_id === selectedAccount)?.name}`
                    : 'Recent Transactions'
                }
                description={
                  selectedAccount
                    ? 'Filtered by selected account'
                    : 'Your latest activity across institutions'
                }
              />
            </section>

            <aside className="space-y-6 xl:col-span-4">
              <Card className="border-0 bg-accent/30 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
                <CardHeader>
                  <CardTitle className="text-lg tracking-tight">Monthly Cash Flow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-32 rounded-2xl bg-linear-to-r from-primary/35 via-secondary/45 to-accent/50" />
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-card/75 p-2">
                      <p className="text-muted-foreground">Income</p>
                      <p className="font-semibold">65%</p>
                    </div>
                    <div className="rounded-xl bg-card/75 p-2">
                      <p className="text-muted-foreground">Expense</p>
                      <p className="font-semibold">28%</p>
                    </div>
                    <div className="rounded-xl bg-card/75 p-2">
                      <p className="text-muted-foreground">Savings</p>
                      <p className="font-semibold">7%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-accent/55 bg-card/85 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
                <CardHeader>
                  <CardTitle className="text-lg tracking-tight">Ledger Intelligence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-xl bg-secondary/35 p-3">
                    <p className="font-medium">Savings Opportunity</p>
                    <p className="text-muted-foreground">Your high-yield accounts are outperforming last month by 1.2%.</p>
                  </div>
                  <div className="rounded-xl bg-secondary/35 p-3">
                    <p className="font-medium">Subscription Alert</p>
                    <p className="text-muted-foreground">Recurring software charges rose by $42 this cycle.</p>
                  </div>
                  <Button variant="secondary" className="w-full">
                    View full briefing
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-0 bg-secondary/45">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-card font-semibold">✓</div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Encrypted Access</p>
                    <p className="text-sm font-medium">Last synced: 2 minutes ago</p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
