'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
      depository: 'bg-[#705866]',
      credit: 'bg-[#814f70]',
      loan: 'bg-[#a8364b]',
      investment: 'bg-[#6c567f]',
    };
    return colors[type] || 'bg-muted-foreground';
  };

  return (
    <Card
      className="cursor-pointer border border-border/60 bg-card/95 py-0 shadow-none transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card"
      onClick={onClick}
    >
      <CardHeader className="gap-1 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getAccountTypeColor(account.type)}`} />
            <CardTitle className="truncate text-base tracking-tight">{account.name}</CardTitle>
          </div>
          <Badge variant="secondary" className="shrink-0 rounded-full capitalize">
            {account.type}
          </Badge>
        </div>
        <CardDescription className="text-xs uppercase tracking-[0.12em]">
          {account.subtype}{account.mask ? ` •••• ${account.mask}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current</p>
            <p className="text-lg font-semibold tracking-tight">{formatCurrency(account.balance.current)}</p>
          </div>

          {account.balance.available !== null && (
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Available</p>
              <p className="text-lg font-semibold">{formatCurrency(account.balance.available)}</p>
            </div>
          )}

          {account.balance.limit !== null && (
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Credit Limit</p>
              <p className="text-lg font-semibold">{formatCurrency(account.balance.limit)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
