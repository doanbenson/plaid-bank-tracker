'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { accountsApi, transactionsApi } from '@/lib/api-client';
import PlaidLinkButton from '@/components/bank/PlaidLinkButton';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import type { Account, Transaction } from '@/lib/api/types/domain';
import { formatCurrency } from '@/lib/formatters';

type GroupedAccounts = Record<string, Account[]>;

const GROUP_META: Record<string, { label: string; colorClass: string; bgClass: string; iconBg: string }> = {
  Savings:      { label: 'Savings',      colorClass: 'text-secondary',    bgClass: 'bg-secondary-container',  iconBg: 'bg-slate-50' },
  Checking:     { label: 'Checking',     colorClass: 'text-blue-600',      bgClass: 'bg-blue-50',             iconBg: 'bg-blue-50' },
  Investments:  { label: 'Investments',  colorClass: 'text-emerald-700',   bgClass: 'bg-emerald-50',          iconBg: 'bg-emerald-50' },
  'Credit Cards': { label: 'Credit Cards', colorClass: 'text-primary',    bgClass: 'bg-primary-container/30', iconBg: 'bg-orange-50' },
  Loans:        { label: 'Loans',        colorClass: 'text-amber-700',     bgClass: 'bg-amber-50',            iconBg: 'bg-amber-50' },
  Other:        { label: 'Other',        colorClass: 'text-on-surface-variant', bgClass: 'bg-surface-variant', iconBg: 'bg-slate-50' },
};

function AccountInitialAvatar({ name, type }: { name: string; type: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const iconBg = GROUP_META[type] ? '' : 'bg-slate-100';
  return (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm text-primary ${iconBg || 'bg-primary-container/40'}`}>
      {initials}
    </div>
  );
}

function AccountRow({
  account,
  onTransfer,
}: {
  account: Account;
  onTransfer: (account: Account) => void;
}) {
  const balance = account.balance.current;
  const isNeg = (balance ?? 0) < 0;

  return (
    <div className="group bg-surface-container-lowest p-4 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.01] hover:bg-white border border-transparent hover:border-secondary-container cursor-pointer">
      <div className="flex items-center gap-4">
        <AccountInitialAvatar name={account.name} type={account.type} />
        <div>
          <h4 className="text-base font-bold text-on-surface">{account.name}</h4>
          <p className="text-xs text-on-surface-variant capitalize">
            {account.subtype}{account.mask ? ` •••• ${account.mask}` : ''}
          </p>
        </div>
      </div>
      <div className="text-right flex items-center gap-3">
        <div>
          <p className={`text-lg font-bold ${isNeg ? 'text-red-600' : 'text-on-background'}`}>
            {formatCurrency(balance)}
          </p>
          {account.balance.available !== null && (
            <p className="text-[10px] text-on-surface-variant">
              Avail: {formatCurrency(account.balance.available)}
            </p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onTransfer(account); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary"
          title="Transfer from this account"
        >
          <span className="material-symbols-outlined text-base">swap_horiz</span>
        </button>
      </div>
    </div>
  );
}

function AccountGroup({
  groupName,
  accounts,
  transactions,
  defaultOpen,
  onTransfer,
}: {
  groupName: string;
  accounts: Account[];
  transactions: Transaction[];
  defaultOpen?: boolean;
  onTransfer: (account: Account) => void;
}) {
  const meta = GROUP_META[groupName] || GROUP_META['Other'];
  const groupTotal = accounts.reduce((s, a) => s + (a.balance.current ?? 0), 0);
  const isNeg = groupTotal < 0;

  // Count pending transactions for this group
  const pendingCount = transactions.filter(
    t => accounts.some(a => a.account_id === t.account_id) && t.pending
  ).length;

  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (defaultOpen && detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, [defaultOpen]);

  return (
    <details ref={detailsRef} className="group/category">
      <summary className="flex items-center justify-between cursor-pointer p-2 hover:bg-surface-variant/20 rounded-xl transition-colors list-none">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant/60 text-lg transition-transform duration-300 group-open/category:rotate-180">
            expand_more
          </span>
          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70">
            {meta.label}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <div className="tooltip-container">
              <span className="text-[9px] bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter cursor-help">
                {pendingCount} PENDING
              </span>
              <span className="tooltip-content font-bold">{pendingCount} pending transaction{pendingCount > 1 ? 's' : ''}</span>
            </div>
          )}
          <span className={`text-[9px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter`}>
            {accounts.length} acct{accounts.length !== 1 ? 's' : ''}
          </span>
          <p className={`text-xs font-bold ${isNeg ? 'text-red-600' : 'text-on-surface-variant'}`}>
            {formatCurrency(groupTotal)}
          </p>
        </div>
      </summary>
      <div className="space-y-3 mt-4 px-1">
        {accounts.map(acct => (
          <AccountRow key={acct.account_id} account={acct} onTransfer={onTransfer} />
        ))}
      </div>
    </details>
  );
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsData, transactionsData] = await Promise.all([
        accountsApi.getAll(),
        transactionsApi.getAll(),
      ]);
      setAccounts(accountsData || []);
      setTransactions(transactionsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchData);
  }, [fetchData]);

  const handleLinkSuccess = () => void fetchData();

  const handleTransfer = (account: Account) => {
    router.push(`/transfer?fromAccount=${account.account_id}`);
  };

  const totalBalance = accounts.reduce((s, a) => s + (a.balance.current ?? 0), 0);
  const activeCount = accounts.length;

  const groupedAccounts: GroupedAccounts = accounts.reduce<GroupedAccounts>((acc, a) => {
    let group = 'Other';
    if (a.type === 'depository' && (a.subtype === 'savings' || a.subtype === 'money market')) {
      group = 'Savings';
    } else if (a.type === 'depository') {
      group = 'Checking';
    } else if (a.type === 'credit') {
      group = 'Credit Cards';
    } else if (a.type === 'investment' || a.type === 'brokerage') {
      group = 'Investments';
    } else if (a.type === 'loan') {
      group = 'Loans';
    }
    acc[group] = acc[group] ? [...acc[group], a] : [a];
    return acc;
  }, {});

  const pendingTx = transactions.filter(t => t.pending).length;
  const incomeTx = transactions.filter(t => t.amount < 0).length;
  const expenseTx = transactions.filter(t => t.amount > 0).length;

  return (
    <>
      {/* Inline styles for tooltip + details marker suppression */}
      <style>{`
        details > summary::-webkit-details-marker { display: none; }
        details[open] summary .material-symbols-outlined.toggle-icon { transform: rotate(180deg); }
        .tooltip-container { position: relative; }
        .tooltip-content {
          visibility: hidden; opacity: 0;
          position: absolute; bottom: 125%; left: 50%;
          transform: translateX(-50%) translateY(10px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: white; color: #3a2f34;
          padding: 8px 12px; border-radius: 12px;
          font-size: 10px; white-space: nowrap;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,.1);
          border: 1px solid #fadaeb; z-index: 50; pointer-events: none;
        }
        .tooltip-container:hover .tooltip-content {
          visibility: visible; opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .glass-header { backdrop-filter: blur(20px); }
      `}</style>

      <div className="min-h-screen bg-transparent">
        {/* Top header */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl lg:ml-64 lg:px-8 glass-header">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Accounts</p>
              <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Ethereal Ledger
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:flex items-center bg-surface-container-low px-4 py-2 rounded-full w-64 group focus-within:bg-white transition-colors">
                <span className="material-symbols-outlined text-outline" style={{ fontSize: '18px' }}>search</span>
                <input
                  className="bg-transparent border-none outline-none text-sm w-full ml-2 placeholder:text-outline-variant"
                  placeholder="Search wealth..."
                  type="text"
                />
              </div>
              <button className="p-2 text-slate-500 hover:bg-blue-50/50 rounded-full transition-colors">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button className="p-2 text-slate-500 hover:bg-blue-50/50 rounded-full transition-colors">
                <span className="material-symbols-outlined">settings</span>
              </button>
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                BD
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 pb-28 lg:ml-64 lg:px-12 lg:py-10 lg:pb-10">
          <div className="max-w-6xl mx-auto">

            {/* Hero summary */}
            <section className="mb-12">
              <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                  <p className="text-on-surface-variant font-medium mb-1 flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    <span className="w-1.5 h-1.5 bg-secondary rounded-full inline-block" />
                    Total Net Liquidity
                  </p>
                  <h2 className="text-5xl md:text-6xl font-extrabold text-on-background tracking-tighter" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {loading ? (
                      <span className="animate-pulse text-4xl text-muted-foreground">Loading…</span>
                    ) : (
                      <>
                        {formatCurrency(totalBalance).replace(/\.\d\d$/, '')}
                        <span className="text-primary-container">.{formatCurrency(totalBalance).match(/\.(\d\d)$/)?.[1] ?? '00'}</span>
                      </>
                    )}
                  </h2>
                </div>

                <div className="flex gap-4">
                  <div className="bg-secondary-container px-6 py-4 rounded-xl flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/40 rounded-lg flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined">trending_up</span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-on-secondary-container/60 leading-none mb-1">Monthly Yield</p>
                      <p className="text-lg font-bold text-on-secondary-container">+4.2%</p>
                    </div>
                  </div>
                  <div className="bg-primary-container px-6 py-4 rounded-xl flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/40 rounded-lg flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">account_balance_wallet</span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-on-primary-container/60 leading-none mb-1">Active Banks</p>
                      <p className="text-lg font-bold text-on-primary-container">{String(activeCount).padStart(2, '0')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Bento grid */}
            <div className="grid grid-cols-12 gap-8">

              {/* Left: Collapsible account groups */}
              <div className="col-span-12 lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Connected Institutions
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-sm font-semibold text-primary hover:underline"
                    onClick={() => router.push('/transaction')}
                  >
                    View Analytics
                  </Button>
                </div>

                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 rounded-2xl bg-surface-container-lowest animate-pulse" />
                    ))}
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="rounded-3xl border border-border/60 bg-card/85 p-10 text-center space-y-4">
                    <span className="material-symbols-outlined text-4xl text-muted-foreground">account_balance</span>
                    <h4 className="text-xl font-semibold">No accounts linked</h4>
                    <p className="text-muted-foreground text-sm">Connect your first bank account to get started.</p>
                    <div className="pt-2">
                      <PlaidLinkButton onSuccess={handleLinkSuccess} buttonText="Link your first account" />
                    </div>
                  </div>
                ) : (
                  Object.entries(groupedAccounts).map(([groupName, groupAccts], i) => (
                    <AccountGroup
                      key={groupName}
                      groupName={groupName}
                      accounts={groupAccts}
                      transactions={transactions}
                      defaultOpen={i === 0}
                      onTransfer={handleTransfer}
                    />
                  ))
                )}
              </div>

              {/* Right: Intelligence column */}
              <div className="col-span-12 lg:col-span-4 space-y-8">

                {/* Cash flow card */}
                <div className="bg-primary-container/20 rounded-3xl p-8 relative overflow-hidden h-[280px]">
                  <div className="relative z-10">
                    <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-2">Monthly Cash Flow</p>
                    <h3 className="text-2xl font-bold text-on-primary-container leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Income vs Expense
                    </h3>
                  </div>
                  {/* Mini bar chart visualisation */}
                  <div className="absolute inset-x-8 bottom-16 top-20 flex items-end gap-1">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const h = Math.round(30 + Math.abs(Math.sin(i * 0.9)) * 60);
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-t-sm bg-primary/20 hover:bg-primary/40 transition-colors"
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="absolute bottom-6 left-8 right-8 z-10 flex gap-2">
                    <div className="bg-white/80 backdrop-blur px-3 py-2 rounded-xl flex-1 text-center">
                      <p className="text-[8px] text-on-surface-variant font-bold uppercase">Income</p>
                      <p className="text-xs font-bold">{incomeTx}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur px-3 py-2 rounded-xl flex-1 text-center">
                      <p className="text-[8px] text-on-surface-variant font-bold uppercase">Expense</p>
                      <p className="text-xs font-bold">{expenseTx}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur px-3 py-2 rounded-xl flex-1 text-center">
                      <p className="text-[8px] text-on-surface-variant font-bold uppercase">Pending</p>
                      <p className="text-xs font-bold">{pendingTx}</p>
                    </div>
                  </div>
                </div>

                {/* Intelligence briefing */}
                <div className="bg-tertiary-container/10 border border-tertiary-container/30 rounded-3xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="material-symbols-outlined text-tertiary">bolt</span>
                    <h3 className="text-lg font-bold text-tertiary" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Ledger Intelligence
                    </h3>
                  </div>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-1 h-auto bg-tertiary rounded-full" />
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        <strong className="text-on-surface">Saving Opportunity:</strong>{' '}
                        Your high-yield savings accounts are outperforming last month by 1.2%.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-1 h-auto bg-primary-dim rounded-full" />
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        <strong className="text-on-surface">Subscription Alert:</strong>{' '}
                        We detected a $42.00 increase in your recurring monthly cloud storage fees.
                      </p>
                    </div>
                    <button
                      className="w-full py-3 rounded-xl border border-tertiary-container text-tertiary text-xs font-bold uppercase tracking-wider hover:bg-tertiary-container/20 transition-colors"
                      onClick={() => router.push('/transaction')}
                    >
                      View Full Briefing
                    </button>
                  </div>
                </div>

                {/* Quick transfer CTA */}
                <div
                  className="bg-primary rounded-2xl p-6 flex items-center gap-4 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => router.push('/transfer')}
                >
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-primary-foreground">
                    <span className="material-symbols-outlined">send_money</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary-foreground/70 uppercase tracking-widest leading-none mb-1">Quick Action</p>
                    <p className="text-base font-bold text-primary-foreground">Transfer Funds</p>
                  </div>
                  <span className="material-symbols-outlined text-primary-foreground/60 ml-auto">arrow_forward</span>
                </div>

                {/* Security badge */}
                <div className="bg-secondary-container/20 rounded-2xl p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-secondary shadow-sm">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-secondary-container uppercase leading-none mb-1">Encrypted Access</p>
                    <p className="text-[10px] text-secondary font-medium">Last synced: 2 minutes ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
