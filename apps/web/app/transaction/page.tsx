'use client';

import { useEffect, useState } from 'react';
import TransactionList from '@/components/bank/TransactionList';
import { transactionsApi } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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

export default function TransactionPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const response = await transactionsApi.getAll();
        setTransactions(response.transactions || []);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const filtered = transactions.filter((transaction) => {
    const searchable = `${transaction.name} ${transaction.merchant_name || ''} ${(transaction.category || []).join(' ')}`.toLowerCase();
    return searchable.includes(query.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl lg:ml-64 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Transactions</p>
            <h1 className="text-xl font-semibold tracking-tight">Activity Ledger</h1>
          </div>
          <Badge variant="secondary" className="rounded-full">
            {transactions.length} entries
          </Badge>
        </div>
      </header>

      <main className="space-y-6 px-4 py-6 pb-28 lg:ml-64 lg:px-8 lg:pb-8">
        <Card className="border-0 bg-card/85 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
          <CardHeader>
            <CardTitle className="tracking-tight">Search Transactions</CardTitle>
            <CardDescription>Filter across merchant, description, and category labels.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search merchant, note, or category"
              className="rounded-full bg-background"
            />
          </CardContent>
        </Card>

        {loading ? (
          <Card className="border-0 bg-card/85 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
            <CardContent className="py-10 text-center text-muted-foreground">Loading transactions...</CardContent>
          </Card>
        ) : (
          <TransactionList
            transactions={filtered}
            title="Posted and Pending Activity"
            description={query ? `Results matching "${query}"` : 'Latest activity across your linked institutions'}
          />
        )}
      </main>
    </div>
  );
}
