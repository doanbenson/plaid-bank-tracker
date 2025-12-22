'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
      <Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.transaction_id}>
                <TableCell className="font-medium">
                  {formatDate(transaction.date)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {transaction.merchant_name || transaction.name}
                    </span>
                    {transaction.pending && (
                      <Badge variant="outline" className="w-fit mt-1 text-xs">
                        Pending
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {transaction.category[0] && (
                    <Badge variant="secondary" className="text-xs">
                      {transaction.category[0]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${
                    isPositive(transaction.amount)
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {isPositive(transaction.amount) ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
