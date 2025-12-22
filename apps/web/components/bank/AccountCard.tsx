'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface AccountCardProps {
  account: {
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
  onClick?: () => void;
}

export default function AccountCard({ account, onClick }: AccountCardProps) {
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getAccountTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      depository: 'bg-blue-500',
      credit: 'bg-purple-500',
      loan: 'bg-orange-500',
      investment: 'bg-green-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{account.name}</CardTitle>
          <Badge variant="outline" className="capitalize">
            {account.subtype}
          </Badge>
        </div>
        {account.mask && (
          <CardDescription>••••{account.mask}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold">
              {formatCurrency(account.balance.current)}
            </p>
          </div>

          {account.balance.available !== null && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(account.balance.available)}
                </p>
              </div>
            </>
          )}

          {account.balance.limit !== null && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Credit Limit</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(account.balance.limit)}
                </p>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 pt-2">
            <div
              className={`w-2 h-2 rounded-full ${getAccountTypeColor(account.type)}`}
            />
            <span className="text-xs text-muted-foreground capitalize">
              {account.type}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
