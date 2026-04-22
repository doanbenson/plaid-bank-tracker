'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Transaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category: string[];
  pending: boolean;
}

interface TransactionListProps {
  transactions: Transaction[];
  title?: string;
  description?: string;
}

export default function TransactionList({
  transactions,
  title = 'Recent Transactions',
  description = 'Your latest banking activity',
}: TransactionListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const isPositive = (amount: number) => amount < 0; // Plaid uses negative for deposits

  if (transactions.length === 0) {
    return (
      <Card className="border-0 bg-card/90 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No transactions found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-card/90 shadow-[0_20px_50px_-40px_rgba(58,47,52,0.55)]">
      <CardHeader>
        <CardTitle className="tracking-tight">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {transactions.map((transaction) => (
          <div
            key={transaction.transaction_id}
            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/50 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">
                  {transaction.merchant_name || transaction.name}
                </p>
                {transaction.pending && (
                  <Badge variant="secondary" className="rounded-full text-xs">
                    Pending
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(transaction.date)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 md:justify-end">
              {transaction.category[0] && (
                <Badge variant="secondary" className="rounded-full text-xs">
                  {transaction.category[0]}
                </Badge>
              )}
              <p
                className={`text-right font-semibold ${
                  isPositive(transaction.amount) ? 'text-primary' : 'text-destructive'
                }`}
              >
                {isPositive(transaction.amount) ? '+' : '-'}
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
